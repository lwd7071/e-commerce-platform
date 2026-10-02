// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewMediaUpload } from "../src/features/review/review-media-upload";

describe("ReviewMediaUpload live storage behavior", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uploads a selected review image through presign, Storage PUT, and finalize", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/media/uploads/presign")) {
        return new Response(JSON.stringify({
          data: {
            media_id: "00000000-0000-4000-8000-000000000101",
            upload_url: "https://storage.test/signed-upload",
            storage_path: "users/buyer/reviews/draft/image.png",
            expires_in_seconds: 600,
          },
          request_id: "req_review_upload",
        }), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url === "https://storage.test/signed-upload") {
        expect(init?.method).toBe("PUT");
        return new Response("OK", { status: 200 });
      }
      if (url.endsWith("/media/uploads/00000000-0000-4000-8000-000000000101/finalize")) {
        return new Response(JSON.stringify({
          data: {
            media_id: "00000000-0000-4000-8000-000000000101",
            public_url: "https://storage.test/review-photo.png",
            storage_path: "users/buyer/reviews/draft/image.png",
            status: "FINALIZED",
          },
          request_id: "req_review_finalize",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    render(<ReviewMediaUpload images={[]} onChange={onChange} reviewId="00000000-0000-4000-8000-000000000201" />);
    await userEvent.upload(screen.getByLabelText("Thêm ảnh"), new File(["png"], "review.png", { type: "image/png" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      purpose: "review_image",
      review_id: "00000000-0000-4000-8000-000000000201",
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        mediaId: "00000000-0000-4000-8000-000000000101",
        url: "https://storage.test/review-photo.png",
      }),
    ]));
  });
});
