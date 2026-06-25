import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChatPane from "../app/components/ChatPane";
import type { Message } from "../app/hooks/useSSEChat";

const noop = () => {};

const defaultProps = {
  messages: [] as Message[],
  streamingContent: "",
  isStreaming: false,
  error: null,
  chatsUsed: 0,
  maxChats: 5,
  onSend: noop,
  onStop: noop,
  onClear: noop,
};

describe("ChatPane", () => {
  it("renders without crashing", () => {
    render(<ChatPane {...defaultProps} />);
    expect(screen.getByRole("log", { name: /chat/i })).toBeInTheDocument();
  });

  it("shows placeholder hint when no messages", () => {
    render(<ChatPane {...defaultProps} />);
    expect(screen.getByText(/ask anything/i)).toBeInTheDocument();
  });

  it("renders user and assistant messages", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello there" },
      { id: "2", role: "assistant", content: "Hi! How can I help?" },
    ];
    render(<ChatPane {...defaultProps} messages={messages} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("shows streaming content with cursor when isStreaming and content present", () => {
    render(
      <ChatPane {...defaultProps} isStreaming streamingContent="I am streaming" />
    );
    expect(screen.getByText(/I am streaming/)).toBeInTheDocument();
  });

  it("shows thinking indicator when isStreaming but no content yet", () => {
    render(<ChatPane {...defaultProps} isStreaming streamingContent="" />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("shows error alert when error prop is set", () => {
    render(<ChatPane {...defaultProps} error="API error 500" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("API error 500");
  });

  it("calls onSend with trimmed input on form submit", async () => {
    const onSend = jest.fn();
    render(<ChatPane {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByLabelText("Message");
    fireEvent.change(textarea, { target: { value: "  test input  " } });
    fireEvent.submit(textarea.closest("form")!);
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("test input"));
  });

  it("does not call onSend when input is blank", async () => {
    const onSend = jest.fn();
    render(<ChatPane {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByLabelText("Message");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.submit(textarea.closest("form")!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = jest.fn();
    render(<ChatPane {...defaultProps} onClear={onClear} />);
    fireEvent.click(screen.getByLabelText(/clear conversation/i));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows stop button and calls onStop while streaming", () => {
    const onStop = jest.fn();
    render(<ChatPane {...defaultProps} isStreaming onStop={onStop} />);
    const stopBtn = screen.getByLabelText(/stop generation/i);
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it("disables textarea while streaming", () => {
    render(<ChatPane {...defaultProps} isStreaming />);
    expect(screen.getByLabelText("Message")).toBeDisabled();
  });

  it("has accessible heading", () => {
    render(<ChatPane {...defaultProps} />);
    expect(screen.getByRole("heading", { name: /chat/i })).toBeInTheDocument();
  });

  it("displays chat counter with used/max chats", () => {
    render(<ChatPane {...defaultProps} chatsUsed={3} maxChats={5} />);
    expect(screen.getByText(/3\/5 chats/i)).toBeInTheDocument();
  });

  it("shows limit-reached message and hides input when chatsUsed equals maxChats", () => {
    render(<ChatPane {...defaultProps} chatsUsed={5} maxChats={5} />);
    expect(screen.getByText(/session limit reached/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  it("calls onClear when 'Refresh your session' button is clicked at limit", () => {
    const onClear = jest.fn();
    render(<ChatPane {...defaultProps} chatsUsed={5} maxChats={5} onClear={onClear} />);
    fireEvent.click(screen.getByText(/refresh your session/i));
    expect(onClear).toHaveBeenCalled();
  });
});
