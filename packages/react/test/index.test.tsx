import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LivenessResult } from "@myidii/web";
import { LivenessButton, useLiveness } from "../src/index";

const { startLiveness } = vi.hoisted(() => ({ startLiveness: vi.fn() }));
vi.mock("@myidii/web", () => ({ startLiveness }));

/** A promise the test resolves or rejects by hand, standing in for an open scan. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const SESSION_URL = "https://verify.myidii.test/s/ses_1";
const PASSED: LivenessResult = { status: "passed", sessionId: "ses_1" };

beforeEach(() => { startLiveness.mockClear(); startLiveness.mockImplementation(() => new Promise(() => {})); });
afterEach(cleanup);

describe("useLiveness", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useLiveness());
    expect(result.current.running).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("is running while the scan is open, then stores the result", async () => {
    const scan = deferred<LivenessResult>();
    startLiveness.mockReturnValue(scan.promise);
    const { result } = renderHook(() => useLiveness());

    let started!: Promise<LivenessResult>;
    act(() => { started = result.current.start(SESSION_URL); });
    expect(result.current.running).toBe(true);
    expect(result.current.result).toBeNull();
    expect(startLiveness).toHaveBeenCalledWith({ url: SESSION_URL });

    await act(async () => { scan.resolve(PASSED); await started; });
    expect(result.current.running).toBe(false);
    expect(result.current.result).toEqual(PASSED);
    await expect(started).resolves.toEqual(PASSED);
  });

  it("passes mode and onCancel through to the web SDK", async () => {
    startLiveness.mockResolvedValue(PASSED);
    const onCancel = vi.fn();
    const { result } = renderHook(() => useLiveness({ mode: "redirect", onCancel }));
    await act(() => result.current.start(SESSION_URL));
    expect(startLiveness).toHaveBeenCalledWith({ mode: "redirect", onCancel, url: SESSION_URL });
  });

  it("always uses the url given to start, even if options carry one", async () => {
    startLiveness.mockResolvedValue(PASSED);
    const { result } = renderHook(() => useLiveness({ url: "https://wrong.test" } as never));
    await act(() => result.current.start(SESSION_URL));
    expect(startLiveness.mock.calls[0][0].url).toBe(SESSION_URL);
  });

  it("reads the latest options without changing start", async () => {
    startLiveness.mockResolvedValue(PASSED);
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onCancel }) => useLiveness({ onCancel }), { initialProps: { onCancel: first } });
    const start = result.current.start;
    rerender({ onCancel: second });
    expect(result.current.start).toBe(start);
    await act(() => result.current.start(SESSION_URL));
    expect(startLiveness.mock.calls[0][0].onCancel).toBe(second);
  });

  it("stops running and rethrows when the scan rejects, keeping the old result", async () => {
    startLiveness.mockResolvedValueOnce(PASSED).mockRejectedValueOnce(new Error("A scan is already open."));
    const { result } = renderHook(() => useLiveness());
    await act(() => result.current.start(SESSION_URL));
    await act(async () => { await expect(result.current.start(SESSION_URL)).rejects.toThrow("A scan is already open."); });
    expect(result.current.running).toBe(false);
    expect(result.current.result).toEqual(PASSED);
  });

  it("replaces the result on each scan", async () => {
    startLiveness.mockResolvedValueOnce({ status: "cancelled", sessionId: null }).mockResolvedValueOnce(PASSED);
    const { result } = renderHook(() => useLiveness());
    await act(() => result.current.start(SESSION_URL));
    expect(result.current.result).toEqual({ status: "cancelled", sessionId: null });
    await act(() => result.current.start(SESSION_URL));
    expect(result.current.result).toEqual(PASSED);
  });
});

describe("LivenessButton", () => {
  it("renders a plain button with the default label", () => {
    render(<LivenessButton getUrl={async () => SESSION_URL} />);
    const button = screen.getByRole("button", { name: "Verify it's me" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("passes children, className and other button props through", () => {
    render(
      <LivenessButton getUrl={async () => SESSION_URL} className="btn btn-primary" id="verify" data-testid="lb" title="Check">
        <span>Start check</span>
      </LivenessButton>,
    );
    const button = screen.getByTestId("lb");
    expect(button.className).toBe("btn btn-primary");
    expect(button.id).toBe("verify");
    expect(button.title).toBe("Check");
    expect(button.innerHTML).toBe("<span>Start check</span>");
  });

  it("is busy and disabled while the scan runs, then calls onResult", async () => {
    const scan = deferred<LivenessResult>();
    startLiveness.mockReturnValue(scan.promise);
    const getUrl = vi.fn(async () => SESSION_URL);
    const onResult = vi.fn();
    const onError = vi.fn();
    render(<LivenessButton getUrl={getUrl} onResult={onResult} onError={onError} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(getUrl).toHaveBeenCalledTimes(1);
    expect(startLiveness).toHaveBeenCalledWith({ mode: undefined, url: SESSION_URL });

    await act(async () => scan.resolve(PASSED));
    expect(onResult).toHaveBeenCalledWith(PASSED);
    expect(onError).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("passes mode to the scan", async () => {
    startLiveness.mockResolvedValue(PASSED);
    render(<LivenessButton getUrl={async () => SESSION_URL} mode="redirect" />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(startLiveness).toHaveBeenCalledWith({ mode: "redirect", url: SESSION_URL });
  });

  it("stays disabled when the disabled prop is set, and does not start", async () => {
    const getUrl = vi.fn(async () => SESSION_URL);
    render(<LivenessButton getUrl={getUrl} disabled />);
    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => fireEvent.click(button));
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("calls onError when getUrl throws, without starting a scan", async () => {
    const error = new Error("session failed");
    const onResult = vi.fn();
    const onError = vi.fn();
    render(<LivenessButton getUrl={() => Promise.reject(error)} onResult={onResult} onError={onError} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(onError).toHaveBeenCalledWith(error);
    expect(onResult).not.toHaveBeenCalled();
    expect(startLiveness).not.toHaveBeenCalled();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it("calls onError when the scan rejects, and is usable again after", async () => {
    const error = new Error("A scan is already open.");
    startLiveness.mockRejectedValue(error);
    const onError = vi.fn();
    render(<LivenessButton getUrl={async () => SESSION_URL} onError={onError} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(onError).toHaveBeenCalledWith(error);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it("swallows errors when no onError is given", async () => {
    render(<LivenessButton getUrl={() => Promise.reject(new Error("nope"))} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it("works without onResult", async () => {
    startLiveness.mockResolvedValue(PASSED);
    render(<LivenessButton getUrl={async () => SESSION_URL} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(startLiveness).toHaveBeenCalledTimes(1);
  });
});
