// The React package against the real @myidii/web source: a click opens the overlay and a message from the
// scan page reaches onResult.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LivenessButton } from "../src/index";

afterEach(cleanup);

describe("LivenessButton with @myidii/web", () => {
  it("opens the scan and reports the result", async () => {
    const onResult = vi.fn();
    render(<LivenessButton getUrl={async () => "https://verify.myidii.test/s/ses_7"} onResult={onResult} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));

    const iframe = document.querySelector<HTMLIFrameElement>("[data-myidii] iframe")!;
    expect(new URL(iframe.src).searchParams.get("embed")).toBe("1");
    expect(screen.getByRole("button", { name: "Verify it's me" }).getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://verify.myidii.test",
        data: { type: "myidii:liveness", event: "done", status: "passed", sessionId: "ses_7" },
      }));
    });
    expect(onResult).toHaveBeenCalledWith({ status: "passed", sessionId: "ses_7" });
    expect(screen.getByRole("button", { name: "Verify it's me" }).getAttribute("aria-busy")).toBe("false");
  });
});
