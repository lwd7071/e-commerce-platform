import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/login", "/products", "/profile", "/notifications", "/checkout", "/seller/orders", "/admin"];
const viewports = [360, 768, 1280];

test("release routes remain usable without horizontal overflow at supported viewports", async ({ page }) => {
  for (const route of routes) {
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("body")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `${route} overflows at ${width}px`).toBe(false);
    }
  }
});

test("public entry and catalog screens have no critical or serious Axe violations", async ({ page }) => {
  for (const route of ["/", "/login", "/products"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(route, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((item) => item.impact === "critical" || item.impact === "serious");
    expect(blocking, `${route}: ${JSON.stringify(blocking.map(({ id, description, nodes }) => ({ id, description, nodes: nodes.map((node) => node.target) })))}`).toEqual([]);
  }
});

test("profile and notification guest states remain accessible on mobile and desktop", async ({ page }) => {
  for (const [route, width] of [["/profile", 360], ["/profile", 1280], ["/notifications", 360], ["/notifications", 1280]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route, { waitUntil: "networkidle" });

    if (route === "/profile") {
      await expect(page.locator("#main-content").getByRole("link", { name: "Đăng nhập" })).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/login\?returnTo=%2Fnotifications/);
      await expect(page.getByRole("button", { name: /^đăng nhập$/i })).toBeVisible();
    }

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((item) => item.impact === "critical" || item.impact === "serious");
    expect(blocking, `${route} at ${width}px: ${JSON.stringify(blocking.map(({ id, description, nodes }) => ({ id, description, nodes: nodes.map((node) => node.target) })))}`).toEqual([]);
  }
});

test("guest account flows keep a usable sign-in path", async ({ page }) => {
  for (const route of ["/profile", "/notifications", "/checkout", "/seller/orders", "/admin"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const expectedReturnTo = encodeURIComponent(route);
    if (new URL(page.url()).pathname === "/login") {
      await expect(page).toHaveURL(new RegExp(`returnTo=${expectedReturnTo.replaceAll("/", "%2F")}`));
      await expect(page.getByRole("button", { name: /^đăng nhập$/i })).toBeVisible();
    } else {
      await expect(page.locator(`a[href*="returnTo=${expectedReturnTo}"]`)).toBeVisible();
    }
  }
});
