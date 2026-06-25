import { renderHook, act, waitFor } from "@testing-library/react";
import { useSSEChat } from "../app/hooks/useSSEChat";

// ── localStorage mock ──────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ── crypto.randomUUID mock ─────────────────────────────────────────────────
Object.defineProperty(window, "crypto", {
  value: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
});

// ── SSE stream helpers ─────────────────────────────────────────────────────
function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });
}

function mockFetch(lines: string[]) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    body: makeSSEStream(lines),
  } as unknown as Response);
}

beforeEach(() => {
  global.fetch = jest.fn();
  localStorageMock.clear();
});

afterEach(() => {
  jest.resetAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe("useSSEChat", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useSSEChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.events).toEqual([]);
    expect(result.current.streamingContent).toBe("");
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.chatsUsed).toBe(0);
  });

  it("adds user message immediately on sendMessage", async () => {
    mockFetch([
      'data: {"type":"response_start"}',
      'data: {"type":"text_delta","content":"Hello"}',
      'data: {"type":"done"}',
    ]);

    const { result } = renderHook(() => useSSEChat());

    act(() => { result.current.sendMessage("Hi there"); });

    await waitFor(() =>
      expect(result.current.messages.some((m) => m.role === "user")).toBe(true)
    );

    const userMsg = result.current.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toBe("Hi there");
  });

  it("appends assistant message after stream completes", async () => {
    mockFetch([
      'data: {"type":"response_start"}',
      'data: {"type":"text_delta","content":"Hi"}',
      'data: {"type":"text_delta","content":" there"}',
      'data: {"type":"done"}',
    ]);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("Hello"); });

    await waitFor(() =>
      expect(result.current.messages.some((m) => m.role === "assistant")).toBe(true)
    );

    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg?.content).toBe("Hi there");
  });

  it("adds tool_call and tool_result events to events list", async () => {
    mockFetch([
      'data: {"type":"tool_call","name":"get_weather","input":{"city":"London"}}',
      'data: {"type":"tool_result","name":"get_weather","result":"18°C"}',
      'data: {"type":"text_delta","content":"It is 18°C."}',
      'data: {"type":"done"}',
    ]);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("Weather in London?"); });

    await waitFor(() =>
      expect(result.current.events.some((e) => e.type === "tool_call")).toBe(true)
    );

    const toolCall = result.current.events.find((e) => e.type === "tool_call");
    expect(toolCall?.toolName).toBe("get_weather");

    const toolResult = result.current.events.find((e) => e.type === "tool_result");
    expect(toolResult?.content).toBe("18°C");
  });

  it("sets error state on HTTP error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as unknown as Response);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("test"); });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatch(/500/);
  });

  it("sets error when response body is null", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: null,
    } as unknown as Response);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("test"); });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatch(/empty response/i);
  });

  it("sets error when stream ends without done event and no content", async () => {
    mockFetch(['data: {"type":"thinking","content":"started"}']);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("test"); });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatch(/unexpectedly/i);
  });

  it("clears all state on clearAll", async () => {
    mockFetch([
      'data: {"type":"text_delta","content":"Hi"}',
      'data: {"type":"done"}',
    ]);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("Hello"); });

    act(() => { result.current.clearAll(); });

    expect(result.current.messages).toEqual([]);
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("trims whitespace from user input", async () => {
    mockFetch(['data: {"type":"done"}']);

    const { result } = renderHook(() => useSSEChat());

    act(() => { result.current.sendMessage("  hello  "); });

    await waitFor(() =>
      expect(result.current.messages.some((m) => m.role === "user")).toBe(true)
    );

    const userMsg = result.current.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toBe("hello");
  });

  it("does not send blank messages", async () => {
    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("   "); });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("sets isStreaming to false after completion", async () => {
    mockFetch([
      'data: {"type":"text_delta","content":"Done"}',
      'data: {"type":"done"}',
    ]);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("test"); });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });

  it("increments chatsUsed and persists to localStorage after done event", async () => {
    mockFetch([
      'data: {"type":"text_delta","content":"Hi"}',
      'data: {"type":"done"}',
    ]);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("Hello"); });

    await waitFor(() => expect(result.current.chatsUsed).toBe(1));
    expect(localStorageMock.getItem("llmdemo_chat_count")).toBe("1");
  });

  it("loads chatsUsed from localStorage on mount", async () => {
    localStorageMock.setItem("llmdemo_chat_count", "3");

    const { result } = renderHook(() => useSSEChat());

    await waitFor(() => expect(result.current.chatsUsed).toBe(3));
  });

  it("sends X-Session-Token header with each request", async () => {
    mockFetch(['data: {"type":"done"}']);

    const { result } = renderHook(() => useSSEChat());

    await act(async () => { await result.current.sendMessage("Hi"); });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers["X-Session-Token"]).toBeTruthy();
  });
});
