import { expect, test, type Page } from "@playwright/test";

// Routes that must never scroll sideways or let anything hang off the right edge,
// whatever width the phone is. /nope stands in for any 404.
const ROUTES = ["/", "/cart", "/checkout", "/order/lookup", "/feedback", "/nope"];
const WIDTHS = [320, 390, 430];
const MIN_TAP_TARGET = 44;
const CART_STORAGE_KEY = "dawgtreats.cart";

let seedFlavorId: string;

test.beforeAll(async ({ browser }) => {
  // The menu never prints a flavor's id, so the only honest way to get a real one
  // is to add a real flavor to a real cart and read back what the app itself wrote.
  const page = await browser.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Add" }).first().click();
  seedFlavorId = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    const lines = raw ? JSON.parse(raw) : [];
    return lines[0]?.flavorId ?? "";
  }, CART_STORAGE_KEY);
  await page.close();
  if (!seedFlavorId) throw new Error("Could not read a flavor id back from the cart; is the menu seeded?");
});

// An element inside a container that is deliberately horizontally scrollable, or
// anything positioned fixed (the feedback button, dialogs), is allowed past the
// viewport edge on purpose and must not be flagged.
function findOverflowingElements() {
  const vw = window.innerWidth;
  const offenders: string[] = [];

  function isDeliberatelyScrollable(el: Element): boolean {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position === "fixed") return true;
      if (node !== el && (style.overflowX === "auto" || style.overflowX === "scroll")) return true;
    }
    return false;
  }

  document.querySelectorAll("body *").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // not actually rendered
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    if (isDeliberatelyScrollable(el)) return;
    if (rect.right > vw + 1) {
      const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      const text = (el.textContent ?? "").trim().slice(0, 30);
      offenders.push(
        `<${el.tagName.toLowerCase()}${classes ? "." + classes : ""}> "${text}" right=${Math.round(rect.right)} > viewport=${vw}`,
      );
    }
  });

  return offenders;
}

// The whole page, not just <main>: the header and the floating buttons are the ones a
// thumb reaches most, and they sat outside this check while it only read the article.
function findTinyTapTargets(minHeight: number) {
  const offenders: string[] = [];

  // A link inside a sentence cannot be made taller without breaking the line it sits
  // in, which is why WCAG 2.5.8 exempts them. It counts as inside a sentence only when
  // it flows as text in a text element beside other words; a row of links is not one.
  const TEXT_PARENTS = new Set(["P", "SPAN", "LI", "LABEL", "SMALL"]);
  const insideSentence = (el: Element) => {
    const parent = el.parentElement;
    if (!parent || !TEXT_PARENTS.has(parent.tagName)) return false;
    if (getComputedStyle(el).display !== "inline") return false;
    const own = (el.textContent ?? "").trim();
    const around = (parent.textContent ?? "").trim();
    return around.length > own.length + 1;
  };

  document.body.querySelectorAll("button, a").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // not visible, not a real target
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    // An inert subtree, such as the closed menu drawer, cannot be tapped at all.
    if (el.closest("[inert]")) return;
    if (insideSentence(el)) return;
    if (rect.height < minHeight) {
      const text = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30);
      offenders.push(`<${el.tagName.toLowerCase()}> "${text}" height=${rect.height.toFixed(1)}px`);
    }
  });

  return offenders;
}

async function assertLayoutInvariants(page: Page, label: string, width: number) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `${label} at ${width}px: the page scrolls sideways (document scrollWidth ${scrollWidth}px exceeds the ${width}px viewport)`,
  ).toBeLessThanOrEqual(width);
  // The viewport itself should report back at the width we asked for.
  expect(clientWidth).toBeLessThanOrEqual(width);

  const overflowing = await page.evaluate(findOverflowingElements);
  expect(
    overflowing,
    `${label} at ${width}px: ${overflowing.length} element(s) extend past the right edge of the viewport:\n${overflowing.join("\n")}`,
  ).toEqual([]);

  const cartLink = page.getByRole("link", { name: /^Cart/ });
  await expect(cartLink, `${label} at ${width}px: the cart link in the header is not visible`).toBeVisible();
  const cartBox = await cartLink.boundingBox();
  if (!cartBox) throw new Error(`${label} at ${width}px: the cart link has no bounding box`);
  expect(
    cartBox.x,
    `${label} at ${width}px: the cart link's left edge is off-screen (x=${cartBox.x})`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    cartBox.x + cartBox.width,
    `${label} at ${width}px: the cart link's right edge is off-screen (right=${cartBox.x + cartBox.width}, viewport=${width})`,
  ).toBeLessThanOrEqual(width);

  const tiny = await page.evaluate(findTinyTapTargets, MIN_TAP_TARGET);
  expect(
    tiny,
    `${label} at ${width}px: ${tiny.length} tap target(s) are under ${MIN_TAP_TARGET}px tall:\n${tiny.join("\n")}`,
  ).toEqual([]);
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    for (const route of ROUTES) {
      test(`${route} never breaks layout`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);
        await assertLayoutInvariants(page, route, width);
      });
    }

    test("/cart with items never breaks layout", async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(
        ([key, flavorId]) => {
          window.localStorage.setItem(key, JSON.stringify([{ flavorId, quantity: 2 }]));
        },
        [CART_STORAGE_KEY, seedFlavorId] as const,
      );
      await page.goto("/cart");
      await assertLayoutInvariants(page, "/cart (seeded with 2 items)", width);
    });
  });
}
