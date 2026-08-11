import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // security.txt يُخدَم مباشرة قبل أي auth (الـ matcher بقى بيمرّره)
  const p = request.nextUrl.pathname;
  if (p === "/.well-known/security.txt") {
    return new NextResponse(
      "Contact: mailto:security@niqatcrm.com\n" +
      "Expires: 2027-07-18T00:00:00.000Z\n" +
      "Preferred-Languages: ar, en\n",
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        }
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  
  // 🔴 التعديل هنا: ضفنا مسار الـ callback للقائمة المسموح بيها
  const PUBLIC = ["/login", "/accept-invite", "/reset-password", "/forgot-password", "/auth/callback", "/auth/auth-code-error"];
  const isPublic = PUBLIC.includes(path) || path.startsWith("/portal");
  
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (user && path === "/login") return NextResponse.redirect(new URL("/", request.url));

  // عزل تيم التعليم على مستوى الراوت:
  // عضو تعليم نشط ومش أدمن عام → يُسمح له بـ /education و/api و/auth فقط،
  // وأي صفحة تانية تتحوّل تلقائياً لـ /education. (استعلام واحد للأغلبية غير التعليمية = صفر صفوف)
  if (user && !isPublic) {
    const isEduPath = path === "/education" || path.startsWith("/education/");
    const bypass = isEduPath || path.startsWith("/api/") || path.startsWith("/auth/") || path.startsWith("/_next");
    if (!bypass) {
      const { data: em } = await supabase
        .from("edu_members").select("active")
        .eq("profile_id", user.id).eq("active", true).maybeSingle();
      if (em) {
        const { data: prof } = await supabase
          .from("profiles").select("team").eq("id", user.id).maybeSingle();
        const isAdmin = (prof?.team || "").toLowerCase() === "admin";
        if (!isAdmin) return NextResponse.redirect(new URL("/education", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
