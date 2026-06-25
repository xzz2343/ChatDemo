import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EventLogPane from "../app/components/EventLogPane";
import type { LogEvent } from "../app/hooks/useSSEChat";

function makeEvent(overrides: Partial<LogEvent>): LogEvent {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date("2026-06-25T12:34:01Z"),
    type: "thinking",
    ...overrides,
  };
}

describe("EventLogPane", () => {
  it("renders without crashing", () => {
    render(<EventLogPane events={[]} />);
    expect(screen.getByRole("log", { name: /agent event log/i })).toBeInTheDocument();
  });

  it("shows placeholder when no events", () => {
    render(<EventLogPane events={[]} />);
    expect(screen.getByText(/events will appear/i)).toBeInTheDocument();
  });

  it("shows event count in header", () => {
    const events = [
      makeEvent({ type: "thinking", content: "User message received" }),
      makeEvent({ type: "response_start", content: "Generating response…" }),
    ];
    render(<EventLogPane events={events} />);
    expect(screen.getByText("2 events")).toBeInTheDocument();
  });

  it("renders thinking event content", () => {
    const events = [makeEvent({ type: "thinking", content: "User message received" })];
    render(<EventLogPane events={events} />);
    expect(screen.getByText(/user message received/i)).toBeInTheDocument();
  });

  it("renders tool_call with tool name and input", () => {
    const events = [
      makeEvent({
        type: "tool_call",
        toolName: "get_weather",
        toolInput: { city: "London" },
      }),
    ];
    render(<EventLogPane events={events} />);
    expect(screen.getByText(/get_weather/)).toBeInTheDocument();
    expect(screen.getByText(/London/)).toBeInTheDocument();
  });

  it("renders tool_result with name and content", () => {
    const events = [
      makeEvent({
        type: "tool_result",
        toolName: "get_weather",
        content: "18°C, partly cloudy",
      }),
    ];
    render(<EventLogPane events={events} />);
    expect(screen.getByText(/18°C/)).toBeInTheDocument();
  });

  it("renders stats event with elapsed time and tokens", () => {
    const events = [
      makeEvent({ type: "stats", elapsedMs: 1800, tokens: 340 }),
    ];
    render(<EventLogPane events={events} />);
    expect(screen.getByText(/1\.8s/)).toBeInTheDocument();
    expect(screen.getByText(/340 tokens/)).toBeInTheDocument();
  });

  it("renders error event with role=alert", () => {
    const events = [makeEvent({ type: "error", content: "API timeout" })];
    render(<EventLogPane events={events} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("API timeout");
  });

  it("has accessible heading", () => {
    render(<EventLogPane events={[]} />);
    expect(screen.getByRole("heading", { name: /agent internals/i })).toBeInTheDocument();
  });

  it("shows singular 'event' for exactly one event", () => {
    const events = [makeEvent({ type: "thinking", content: "one" })];
    render(<EventLogPane events={events} />);
    expect(screen.getByText("1 event")).toBeInTheDocument();
  });
});
