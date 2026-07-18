export const dynamic = "force-static";

export function GET() {
  const body = [
    "Contact: mailto:security@niqatcrm.com",
    "Expires: 2027-07-18T00:00:00.000Z",
    "Preferred-Languages: ar, en",
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
