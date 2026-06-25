<?php
declare(strict_types=1);

// ─────────────────────────────────────────────
// Configuration — set your key before deploying
// ─────────────────────────────────────────────
define('ANTHROPIC_API_KEY', '%%ANTHROPIC_API_KEY%%');
define('ANTHROPIC_MODEL',   'claude-sonnet-4-6');
define('MAX_TOKENS',        1024);
define('MAX_TOOL_ROUNDS',   5);
define('START_TIME',        microtime(true));

set_time_limit(120); // allow up to 2 min for multi-round tool loops

// ─────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────
define('MAX_CHATS_PER_SESSION',        5);
define('MAX_REQUESTS_PER_IP_PER_HOUR', 30);
define('RATE_LIMIT_DIR',               sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'llmdemo_rl');

// ─────────────────────────────────────────────
// CORS — restrict to your domain in production
// ─────────────────────────────────────────────
header('Access-Control-Allow-Origin: https://buckshot-consulting.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Session-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ─────────────────────────────────────────────
// SSE setup
// ─────────────────────────────────────────────
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no');

if (ob_get_level()) ob_end_clean();

function sse(string $type, array $data = []): void {
    $data['type'] = $type;
    echo 'data: ' . json_encode($data) . "\n\n";
    if (ob_get_level()) ob_flush();
    flush();
}

function sseError(string $message): void {
    sse('error', ['message' => $message]);
    sse('done');
    exit;
}

// ─────────────────────────────────────────────
// Rate limit helpers (file-based, flock-safe)
// ─────────────────────────────────────────────
function rl_dir(): string {
    $dir = RATE_LIMIT_DIR;
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir;
}

function check_ip_limit(): void {
    $ip  = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash('sha256', $ip); // hash raw IP for privacy
    $file = rl_dir() . DIRECTORY_SEPARATOR . 'ip_' . $key . '.json';

    $fp = @fopen($file, 'c+');
    if (!$fp) return; // can't open → skip rather than block

    flock($fp, LOCK_EX);

    $raw        = stream_get_contents($fp);
    $timestamps = $raw ? (json_decode($raw, true) ?? []) : [];
    if (!is_array($timestamps)) $timestamps = [];

    $cutoff     = time() - 3600;
    $timestamps = array_values(array_filter($timestamps, fn($t) => $t > $cutoff));

    if (count($timestamps) >= MAX_REQUESTS_PER_IP_PER_HOUR) {
        flock($fp, LOCK_UN);
        fclose($fp);
        sseError('Hourly rate limit reached. Please try again in a little while.');
    }

    $timestamps[] = time();
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($timestamps));
    flock($fp, LOCK_UN);
    fclose($fp);
}

function session_file(string $token): string|false {
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $token)) {
        return false;
    }
    return rl_dir() . DIRECTORY_SEPARATOR . 'sess_' . hash('sha256', $token) . '.json';
}

function check_session_limit(string $token): void {
    $file = session_file($token);
    if ($file === false) return;

    $fp = @fopen($file, 'c+');
    if (!$fp) return;

    flock($fp, LOCK_EX);
    $raw   = stream_get_contents($fp);
    $data  = $raw ? (json_decode($raw, true) ?? []) : [];
    $count = (int) (is_array($data) ? ($data['count'] ?? 0) : 0);
    flock($fp, LOCK_UN);
    fclose($fp);

    if ($count >= MAX_CHATS_PER_SESSION) {
        sseError('You\'ve used all ' . MAX_CHATS_PER_SESSION . ' chats for this session. Open a private/incognito window to start a new session.');
    }
}

function increment_session_count(string $token): void {
    $file = session_file($token);
    if ($file === false) return;

    $fp = @fopen($file, 'c+');
    if (!$fp) return;

    flock($fp, LOCK_EX);
    $raw  = stream_get_contents($fp);
    $data = $raw ? (json_decode($raw, true) ?? []) : [];
    if (!is_array($data)) $data = [];

    $data['count'] = (int) ($data['count'] ?? 0) + 1;
    $data['last']  = time();
    if (!isset($data['created'])) $data['created'] = time();

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    flock($fp, LOCK_UN);
    fclose($fp);
}

function maybe_cleanup_old_files(): void {
    if (random_int(1, 100) !== 1) return; // run ~1% of requests
    $dir    = RATE_LIMIT_DIR;
    $cutoff = time() - 86400; // purge files untouched for 24 h
    if (!is_dir($dir)) return;
    foreach (glob($dir . DIRECTORY_SEPARATOR . '*.json') ?: [] as $f) {
        if (@filemtime($f) < $cutoff) {
            @unlink($f);
        }
    }
}

check_ip_limit();
$sessionToken = trim($_SERVER['HTTP_X_SESSION_TOKEN'] ?? '');
if ($sessionToken !== '') {
    check_session_limit($sessionToken);
}
maybe_cleanup_old_files();

// ─────────────────────────────────────────────
// Parse request body
// ─────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);
if (!$body || !isset($body['messages']) || !is_array($body['messages'])) {
    sseError('Invalid request body');
}

$messages = $body['messages'];

// ─────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────
$tools = [
    [
        'name'        => 'get_current_datetime',
        'description' => 'Returns the current UTC date and time.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => (object)[],
            'required'   => [],
        ],
    ],
    [
        'name'        => 'calculate',
        'description' => 'Evaluates a safe arithmetic expression and returns the result. Supports +, -, *, /, parentheses, and decimal numbers.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => [
                'expression' => [
                    'type'        => 'string',
                    'description' => 'A math expression, e.g. "1337 * 42" or "(100 + 50) / 3"',
                ],
            ],
            'required' => ['expression'],
        ],
    ],
    [
        'name'        => 'get_weather',
        'description' => 'Returns current weather conditions (temperature and description) for a given city using the Open-Meteo API.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => [
                'city' => [
                    'type'        => 'string',
                    'description' => 'The city name, e.g. "London" or "Tokyo"',
                ],
            ],
            'required' => ['city'],
        ],
    ],
];

// ─────────────────────────────────────────────
// Tool execution
// ─────────────────────────────────────────────
function tool_get_current_datetime(): string {
    date_default_timezone_set('UTC');
    return date('Y-m-d H:i:s T');
}

// Recursive descent parser — replaces eval() which is blocked on many shared hosts.
class ExprParser {
    private array $tokens;
    private int $pos = 0;

    public function __construct(string $expr) {
        preg_match_all('/\d+\.?\d*|[+\-*\/()]/', $expr, $m);
        $this->tokens = $m[0];
    }

    public function parse(): float {
        $result = $this->parseExpr();
        if ($this->pos < count($this->tokens)) {
            throw new \RuntimeException('Unexpected token: ' . $this->tokens[$this->pos]);
        }
        return $result;
    }

    private function parseExpr(): float {
        $result = $this->parseTerm();
        while ($this->pos < count($this->tokens) && in_array($this->tokens[$this->pos], ['+', '-'])) {
            $op = $this->tokens[$this->pos++];
            $right = $this->parseTerm();
            $result = $op === '+' ? $result + $right : $result - $right;
        }
        return $result;
    }

    private function parseTerm(): float {
        $result = $this->parseFactor();
        while ($this->pos < count($this->tokens) && in_array($this->tokens[$this->pos], ['*', '/'])) {
            $op = $this->tokens[$this->pos++];
            $right = $this->parseFactor();
            if ($op === '/') {
                if ($right == 0) throw new \RuntimeException('Division by zero');
                $result /= $right;
            } else {
                $result *= $right;
            }
        }
        return $result;
    }

    private function parseFactor(): float {
        if ($this->pos >= count($this->tokens)) {
            throw new \RuntimeException('Unexpected end of expression');
        }
        $token = $this->tokens[$this->pos];
        if ($token === '(') {
            $this->pos++;
            $result = $this->parseExpr();
            if ($this->pos >= count($this->tokens) || $this->tokens[$this->pos] !== ')') {
                throw new \RuntimeException('Missing closing parenthesis');
            }
            $this->pos++;
            return $result;
        }
        if ($token === '-') {
            $this->pos++;
            return -$this->parseFactor();
        }
        if (is_numeric($token)) {
            $this->pos++;
            return (float) $token;
        }
        throw new \RuntimeException('Unexpected token: ' . $token);
    }
}

function tool_calculate(string $expression): string {
    if (!preg_match('/^[\d\s\+\-\*\/\(\)\.]+$/', $expression)) {
        return 'Error: expression contains disallowed characters';
    }
    $expression = trim($expression);
    if ($expression === '') {
        return 'Error: empty expression';
    }
    try {
        $result = (new ExprParser($expression))->parse();
        if ($result == (int) $result) {
            return (string) (int) $result;
        }
        return rtrim(rtrim(number_format($result, 10, '.', ''), '0'), '.');
    } catch (\Throwable $e) {
        return 'Error: ' . $e->getMessage();
    }
}

function curl_get(string $url): string|false {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $result = curl_exec($ch);
    $err    = curl_error($ch);
    curl_close($ch);
    return $err ? false : $result;
}

function tool_get_weather(string $city): string {
    try {
        // Step 1: Geocode
        $geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name='
            . urlencode($city) . '&count=1&language=en&format=json';
        $geoRaw = curl_get($geoUrl);
        if ($geoRaw === false) {
            return 'Error: could not reach geocoding API';
        }
        $geo = json_decode($geoRaw, true);
        if (!is_array($geo) || empty($geo['results'])) {
            return "City not found: $city";
        }
        $lat     = (float) ($geo['results'][0]['latitude']  ?? 0);
        $lon     = (float) ($geo['results'][0]['longitude'] ?? 0);
        $name    = (string) ($geo['results'][0]['name']     ?? $city);
        $country = (string) ($geo['results'][0]['country']  ?? '');

        // Step 2: Fetch weather
        $weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' . $lat
            . '&longitude=' . $lon
            . '&current=temperature_2m,weathercode,windspeed_10m'
            . '&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto';
        $weatherRaw = curl_get($weatherUrl);
        if ($weatherRaw === false) {
            return 'Error: could not reach weather API';
        }
        $weather = json_decode($weatherRaw, true);
        if (!is_array($weather)) {
            return 'Error: unexpected response from weather API';
        }
        $current = $weather['current'] ?? [];

        $temp      = $current['temperature_2m'] ?? 'N/A';
        $windspeed = $current['windspeed_10m']   ?? 'N/A';
        $code      = $current['weathercode']     ?? -1;
        $condition = wmo_code_to_description((int) $code);

        return "$name, $country: {$temp}°C, $condition, wind {$windspeed} km/h";
    } catch (\Throwable $e) {
        return 'Error: ' . $e->getMessage();
    }
}

function wmo_code_to_description(int $code): string {
    $map = [
        0  => 'clear sky',
        1  => 'mainly clear', 2 => 'partly cloudy', 3 => 'overcast',
        45 => 'foggy', 48 => 'rime fog',
        51 => 'light drizzle', 53 => 'moderate drizzle', 55 => 'dense drizzle',
        61 => 'slight rain', 63 => 'moderate rain', 65 => 'heavy rain',
        71 => 'slight snow', 73 => 'moderate snow', 75 => 'heavy snow',
        77 => 'snow grains',
        80 => 'slight showers', 81 => 'moderate showers', 82 => 'violent showers',
        85 => 'slight snow showers', 86 => 'heavy snow showers',
        95 => 'thunderstorm', 96 => 'thunderstorm with hail', 99 => 'thunderstorm with heavy hail',
    ];
    return $map[$code] ?? 'unknown conditions';
}

function execute_tool(string $name, mixed $input): string {
    $input = (array) $input; // input may arrive as stdClass due to (object) cast in tool loop
    switch ($name) {
        case 'get_current_datetime':
            return tool_get_current_datetime();
        case 'calculate':
            return tool_calculate($input['expression'] ?? '');
        case 'get_weather':
            return tool_get_weather($input['city'] ?? '');
        default:
            return "Unknown tool: $name";
    }
}

// ─────────────────────────────────────────────
// Claude API call (non-streaming, handles tools)
// ─────────────────────────────────────────────
function call_claude(array $messages, array $tools): array {
    $payload = [
        'model'      => ANTHROPIC_MODEL,
        'max_tokens' => MAX_TOKENS,
        'tools'      => $tools,
        'messages'   => $messages,
        'system'     => 'You are a helpful AI assistant with access to tools for checking the weather, doing math, and getting the current date/time. Use tools when they help answer the user\'s question accurately. Be concise and friendly.',
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['error' => 'cURL error: ' . $curlError];
    }
    if ($httpCode !== 200) {
        $decoded = json_decode($response, true);
        $msg = $decoded['error']['message'] ?? "HTTP $httpCode";
        return ['error' => $msg];
    }

    return json_decode($response, true) ?? ['error' => 'Invalid JSON from API'];
}

// ─────────────────────────────────────────────
// Main agentic loop
// ─────────────────────────────────────────────
sse('thinking', ['content' => 'User message received']);

$totalInputTokens  = 0;
$totalOutputTokens = 0;

for ($round = 0; $round < MAX_TOOL_ROUNDS; $round++) {
    $result = call_claude($messages, $tools);

    if (isset($result['error'])) {
        sseError($result['error']);
    }

    $totalInputTokens  += $result['usage']['input_tokens']  ?? 0;
    $totalOutputTokens += $result['usage']['output_tokens'] ?? 0;
    $stopReason         = $result['stop_reason'] ?? 'end_turn';
    $content            = $result['content']     ?? [];

    if ($stopReason === 'tool_use') {
        // Collect all text and tool_use blocks from this response
        $assistantContent = [];
        $toolUseBlocks    = [];

        foreach ($content as $block) {
            if ($block['type'] === 'tool_use') {
                // json_decode(..., true) turns {} into [] — cast back to object
                // so it re-encodes as {} when sent in the next API round.
                $block['input'] = (object) ($block['input'] ?? []);
                $toolUseBlocks[] = $block;
            }
            $assistantContent[] = $block;
        }

        // Append assistant turn
        $messages[] = ['role' => 'assistant', 'content' => $assistantContent];

        // Execute each tool and collect results
        $toolResults = [];
        foreach ($toolUseBlocks as $toolBlock) {
            $toolName  = $toolBlock['name'];
            $toolInput = $toolBlock['input'] ?? [];
            $toolId    = $toolBlock['id'];

            sse('tool_call', ['name' => $toolName, 'input' => $toolInput]);

            $toolResult = execute_tool($toolName, $toolInput);

            sse('tool_result', ['name' => $toolName, 'result' => $toolResult]);

            $toolResults[] = [
                'type'        => 'tool_result',
                'tool_use_id' => $toolId,
                'content'     => $toolResult,
            ];
        }

        // Append tool results turn
        $messages[] = ['role' => 'user', 'content' => $toolResults];

        // Continue loop to get final response
        continue;
    }

    // end_turn — stream the text response
    sse('response_start');

    $fullText = '';
    foreach ($content as $block) {
        if ($block['type'] === 'text') {
            $text = $block['text'];
            $fullText .= $text;

            // Stream word-by-word for a typing effect
            $words = preg_split('/(\s+)/', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
            foreach ($words as $word) {
                sse('text_delta', ['content' => $word]);
                usleep(12000); // ~12ms per token, ~80 words/sec
            }
        }
    }

    $elapsed = (int) round((microtime(true) - START_TIME) * 1000);
    sse('stats', [
        'elapsed_ms' => $elapsed,
        'tokens'     => $totalInputTokens + $totalOutputTokens,
    ]);
    if ($sessionToken !== '') increment_session_count($sessionToken);
    sse('done');
    exit;
}

sseError('Reached maximum tool call rounds without a final response');
