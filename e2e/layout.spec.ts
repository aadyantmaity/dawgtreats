import { expect, test, type Page } from "@playwright/test";

// Routes that must never scroll sideways or let anything hang off the right edge, at any
// width. /nope stands in for any 404, and /order/TEST is the paid order that
// scripts/seed-test-fixtures.ts writes.
const ROUTES = ["/", "/cart", "/checkout", "/order/lookup", "/order/TEST", "/feedback", "/nope"];
const WIDTHS = [320, 390, 430, 1280];
const MIN_TOUCH_TARGET = 44;
const MIN_POINTER_TARGET = 24;
const SM_BREAKPOINT = 640;
const minTargetAt = (width: number) =>
  width < SM_BREAKPOINT ? MIN_TOUCH_TARGET : MIN_POINTER_TARGET;
const CART_STORAGE_KEY = "dawgtreats.cart";

let seedFlavorId: string;

// Emptied by scripts/seed-test-fixtures.ts before the server starts, so every worker
// sees the same menu.
const SOLD_OUT_FLAVOR = "Oatmeal raisin";

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
    // While the page composites an animation, a control sized to exactly the minimum
    // measures a hair under it. That is not a small tap target, so allow half a pixel.
    if (rect.height < minHeight - 0.5) {
      const text = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30);
      offenders.push(`<${el.tagName.toLowerCase()}> "${text}" height=${rect.height.toFixed(2)}px`);
    }
  });

  return offenders;
}

// Every route here is dynamic and answers with its loading skeleton first, and the
// display font changes every text metric when it swaps in. Measured before either, a
// real control reports no box and is taken for something that is not there.
async function settled(page: Page) {
  await expect(page.locator(".shimmer")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function assertLayoutInvariants(page: Page, label: string, width: number) {
  await settled(page);

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

  const minTarget = minTargetAt(width);
  const tiny = await page.evaluate(findTinyTapTargets, minTarget);
  expect(
    tiny,
    `${label} at ${width}px: ${tiny.length} tap target(s) are under ${minTarget}px tall:\n${tiny.join("\n")}`,
  ).toEqual([]);
}

test("the menu separates what is sold out from what is for sale", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await settled(page);

  const heading = page.getByRole("heading", { name: "Sold out this week" });
  await expect(heading, "the sold-out heading is missing; is the fixture still sold out?").toBeVisible();

  const soldOut = page.getByRole("heading", { name: SOLD_OUT_FLAVOR });
  await expect(soldOut).toBeVisible();

  // Below the heading, not above it: the whole point is that it stops taking a place in
  // the grid of things someone can buy.
  const headingBox = await heading.boundingBox();
  const cardBox = await soldOut.boundingBox();
  if (!headingBox || !cardBox) throw new Error("the sold-out heading or card has no bounding box");
  expect(cardBox.y).toBeGreaterThan(headingBox.y);

  // The card says so in words, so the dashed border and the grey are not carrying it alone.
  await expect(page.getByText("Sold out", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I wanted this" })).toBeVisible();
});

test("the checkout chooses no pickup time for you", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(
    ([key, flavorId]) => {
      window.localStorage.setItem(key, JSON.stringify([{ flavorId, quantity: 2 }]));
    },
    [CART_STORAGE_KEY, seedFlavorId] as const,
  );
  await page.goto("/checkout");
  await settled(page);

  // Whoever does not notice a preselected time is booked for whenever it happened to be.
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);

  await page.getByRole("button", { name: /^Pay for/ }).click();
  await expect(page.getByText("Choose a pickup time")).toBeVisible();
  await expect(page, "an order with no pickup time left the checkout").toHaveURL(/\/checkout$/);

  await page.locator("label:has(input[name='pickup-slot'])").first().click();
  await expect(page.getByText("Choose a pickup time")).toHaveCount(0);

  // A full slot is listed rather than hidden, so the weekend has no holes in it, but it
  // cannot be chosen. scripts/seed-test-fixtures.ts books the last one solid.
  const full = page.getByRole("radio", { disabled: true });
  await expect(full, "no slot is full; did the fixture book one?").toHaveCount(1);
  await expect(full).not.toBeChecked();
});

test("every pickup chip is the same height at the narrowest phone", async ({ page }) => {
  // 320px leaves about 60px inside a chip, and "12:00 PM" measures 58.7px. A single
  // wrapped time makes its whole row taller than the rest of the grid.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(
    ([key, flavorId]) => {
      window.localStorage.setItem(key, JSON.stringify([{ flavorId, quantity: 1 }]));
    },
    [CART_STORAGE_KEY, seedFlavorId] as const,
  );
  await page.goto("/checkout");
  await settled(page);

  const heights = await page
    .locator("label:has(input[name='pickup-slot'])")
    .evaluateAll((labels) => labels.map((label) => Math.round(label.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThan(1);
  expect(new Set(heights), `the pickup chips are ${[...new Set(heights)].join(" and ")}px tall`).toHaveProperty(
    "size",
    1,
  );
});

test("the floating Pay bar stays flat until the checkout is ready", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(
    ([key, flavorId]) => {
      window.localStorage.setItem(key, JSON.stringify([{ flavorId, quantity: 2 }]));
    },
    [CART_STORAGE_KEY, seedFlavorId] as const,
  );
  await page.goto("/checkout");
  await settled(page);

  // The bar's own button, not the one at the end of the form.
  const bar = page.getByRole("button", { name: "Pay", exact: true });
  await expect(bar).toBeDisabled();

  await page.locator("label:has(input[name='pickup-slot'])").first().click();
  await expect(bar, "a pickup time alone is not a complete form").toBeDisabled();

  await page.getByLabel("Name").fill("Alex Rivera");
  await page.getByLabel("Email").fill("alex@example.com");
  await page.getByLabel("Phone").fill("4255550142");
  await expect(bar).toBeEnabled();
});

// Where the floating feedback button belongs, and the far longer list of places it does
// not. /feedback is the same form as a page, so the button there would open itself.
const FEEDBACK_ON = ["/", "/account", "/order/TEST", "/order/lookup"];
const FEEDBACK_OFF = ["/cart", "/checkout", "/feedback", "/nope"];

test("the feedback button only shows where feedback is worth asking for", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const button = page.getByRole("button", { name: /feedback/i });

  for (const route of FEEDBACK_ON) {
    await page.goto(route);
    await settled(page);
    await expect(button, `${route} should offer the feedback button`).toBeVisible();
  }
  for (const route of FEEDBACK_OFF) {
    await page.goto(route);
    await settled(page);
    await expect(button, `${route} should not offer the feedback button`).toHaveCount(0);
  }
});

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
