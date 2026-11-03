import { subscribe } from "@/lib/server/case-store";
import { corsHeaders } from "@/lib/server/http";
import { requireAppUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAppUser();
  if (denied) return denied;
  const encoder = new TextEncoder();
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          unsubscribe();
        }
      };
      unsubscribe = subscribe(send);
      send({ event: "CONNECTED" });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
