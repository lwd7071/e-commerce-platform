import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import path from "node:path";

const journeys = {
  guest: ["/", "/products", "/products/00000000-0000-0000-0000-000000000101", "/shops/00000000-0000-0000-0000-000000000001", "/login", "/register", "/forgot-password", "/reset-password"],
  buyer: ["/cart", "/checkout", "/orders", "/orders/00000000-0000-0000-0000-000000000001/review", "/profile", "/notifications"],
  seller: ["/seller", "/seller/orders", "/seller/chat", "/seller/products", "/seller/products/new", "/seller/products/00000000-0000-0000-0000-000000000101/edit", "/seller/wallet", "/seller/vouchers", "/seller/reports", "/seller/shop", "/notifications"],
  admin: ["/admin", "/admin/shops", "/admin/categories", "/admin/orders", "/admin/finance", "/admin/reviews", "/admin/vouchers", "/admin/campaigns", "/admin/reports", "/admin/audit-logs"],
} as const;

const narrowCaptureRoutes = new Set(["/", "/products", "/cart", "/checkout", "/profile", "/seller", "/seller/orders", "/seller/chat", "/seller/products", "/seller/products/new", "/seller/wallet", "/admin", "/admin/shops", "/admin/categories", "/admin/orders", "/admin/finance", "/admin/reviews", "/admin/vouchers"]);

async function signInAs(page: Page, role: "buyer" | "seller" | "admin") {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Địa chỉ Email").fill(`${role}@dino-e2e.test`);
  await page.getByLabel("Mật khẩu").fill("Password123!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("mobile role layouts stay inside the viewport and capture before/after journeys", async ({ page }) => {
  await page.route("**/auth/v1/token?grant_type=password", async route => {
    const email = route.request().postDataJSON()?.email ?? "buyer@dino-e2e.test";
    const matchedRole = email.includes("seller") ? "SELLER" : email.includes("admin") ? "ADMIN" : "BUYER";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: `mock-${matchedRole.toLowerCase()}-token`, token_type: "bearer", expires_in: 3600, refresh_token: "mobile-ui-refresh", user: { id: `mobile-${matchedRole.toLowerCase()}`, email, user_metadata: { full_name: `Dino ${matchedRole}` } } }) });
  });
  await page.route("**/api/v1/auth/me", route => {
    const roleName = route.request().headers().authorization?.includes("seller") ? "SELLER" : route.request().headers().authorization?.includes("admin") ? "ADMIN" : "BUYER";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user_id: `mobile-${roleName.toLowerCase()}`, email: `${roleName.toLowerCase()}@dino-e2e.test`, role: roleName, shop_id: roleName === "SELLER" ? "00000000-0000-0000-0000-000000000001" : null, shop_status: roleName === "SELLER" ? "ACTIVE" : null }) });
  });
  const artifactRoot = path.resolve("test-results/mobile-ui/after");
  await fs.mkdir(artifactRoot, { recursive: true });
  const audit: Array<{ role: string; route: string; width: number; overflow: boolean; heading: string; screenshot?: string }> = [];

  for (const [role, routes] of Object.entries(journeys)) {
    if (role !== "guest") await signInAs(page, role as "buyer" | "seller" | "admin");
    for (const route of routes) {
      console.log(`mobile UI: ${role} ${route}`);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      for (const width of [360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: width < 400 ? 800 : 900 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const state = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth, heading: document.querySelector("h1")?.textContent?.trim() ?? "", offenders: document.documentElement.scrollWidth > window.innerWidth ? [...document.querySelectorAll<HTMLElement>("body *")].filter(element => element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: Math.round(element.getBoundingClientRect().right), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })) : [] }));
        const item: (typeof audit)[number] = { role, route, width, ...state };
        expect(state.overflow, `${role} ${route} overflows at ${width}px: ${JSON.stringify(state.offenders)}`).toBe(false);

        if (width === 390 || (width === 360 && narrowCaptureRoutes.has(route))) {
          const dir = path.join(artifactRoot, role);
          await fs.mkdir(dir, { recursive: true });
          const slug = route.replaceAll("/", "_") || "home";
          const screenshot = path.join(dir, `${slug}-${width}.png`);
          await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
          item.screenshot = path.relative(artifactRoot, screenshot);
        }
        const axeRoute = role === "guest" ? "/products" : role === "buyer" ? "/checkout" : role === "seller" ? "/seller" : "/admin";
        if (width === 390 && route === axeRoute) {
          const results = await new AxeBuilder({ page }).analyze();
          const blocking = results.violations.filter(violation => violation.impact === "critical" || violation.impact === "serious");
          expect(blocking.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), `${role} ${route} has critical or serious accessibility violations`).toEqual([]);
        }
        audit.push(item);
      }
    }

    if (role === "seller" || role === "admin") {
      const entry = role === "seller" ? "/seller" : "/admin";
      const buttonName = role === "seller" ? "Menu người bán" : "Menu quản trị";
      const targetName = role === "seller" ? "Đơn bán" : "Gian hàng & Mall";
      const targetRoute = role === "seller" ? "/seller/orders" : "/admin/shops";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(entry);
      await page.getByRole("button", { name: buttonName }).click();
      const drawer = page.getByRole("dialog", { name: role === "seller" ? "Menu người bán" : "Menu quản trị" });
      await expect(drawer).toBeVisible();
      await page.screenshot({ path: path.join(artifactRoot, role, "menu-open-390.png"), fullPage: true, animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await page.getByRole("button", { name: buttonName }).click();
      await drawer.getByRole("link", { name: targetName }).click();
      await expect(page).toHaveURL(new RegExp(`${targetRoute.replaceAll("/", "\\/")}$`));
      await page.getByRole("button", { name: buttonName }).click();
      await expect(drawer.getByRole("link", { name: targetName })).toHaveAttribute("aria-current", "page");
    }
  }
  await fs.writeFile(path.join(artifactRoot, "audit.json"), JSON.stringify(audit, null, 2));
});
