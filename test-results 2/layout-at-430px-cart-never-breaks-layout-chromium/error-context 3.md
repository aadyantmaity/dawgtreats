# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout.spec.ts >> at 430px >> /cart never breaks layout
- Location: e2e/layout.spec.ts:121:11

# Error details

```
Error: /cart at 430px: 1 tap target(s) inside <main> are under 36px tall:
<a> "Back to the menu" height=24.0px

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "<a> \"Back to the menu\" height=24.0px",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "Dawg Treats" [ref=e4] [cursor=pointer]:
        - /url: /
      - navigation [ref=e5]:
        - generic [ref=e6]:
          - link "My order" [ref=e7] [cursor=pointer]:
            - /url: /order/lookup
          - link "Account" [ref=e8] [cursor=pointer]:
            - /url: /account
        - link "Cart, empty" [ref=e9] [cursor=pointer]:
          - /url: /cart
          - text: Cart
  - main [ref=e14]:
    - heading "Your cart" [level=1] [ref=e15]
    - paragraph [ref=e16]: Your cart is empty.
    - link "Back to the menu" [ref=e17] [cursor=pointer]:
      - /url: /
  - button "Send feedback" [ref=e19]: +
  - alert [ref=e20]
```

# Test source

```ts
  15  |   const page = await browser.newPage();
  16  |   await page.goto("/");
  17  |   await page.getByRole("button", { name: "Add" }).first().click();
  18  |   seedFlavorId = await page.evaluate((key) => {
  19  |     const raw = window.localStorage.getItem(key);
  20  |     const lines = raw ? JSON.parse(raw) : [];
  21  |     return lines[0]?.flavorId ?? "";
  22  |   }, CART_STORAGE_KEY);
  23  |   await page.close();
  24  |   if (!seedFlavorId) throw new Error("Could not read a flavor id back from the cart; is the menu seeded?");
  25  | });
  26  | 
  27  | // An element inside a container that is deliberately horizontally scrollable, or
  28  | // anything positioned fixed (the feedback button, dialogs), is allowed past the
  29  | // viewport edge on purpose and must not be flagged.
  30  | function findOverflowingElements() {
  31  |   const vw = window.innerWidth;
  32  |   const offenders: string[] = [];
  33  | 
  34  |   function isDeliberatelyScrollable(el: Element): boolean {
  35  |     for (let node: Element | null = el; node; node = node.parentElement) {
  36  |       const style = getComputedStyle(node);
  37  |       if (style.position === "fixed") return true;
  38  |       if (node !== el && (style.overflowX === "auto" || style.overflowX === "scroll")) return true;
  39  |     }
  40  |     return false;
  41  |   }
  42  | 
  43  |   document.querySelectorAll("body *").forEach((el) => {
  44  |     const rect = el.getBoundingClientRect();
  45  |     if (rect.width === 0 && rect.height === 0) return; // not actually rendered
  46  |     const style = getComputedStyle(el);
  47  |     if (style.display === "none" || style.visibility === "hidden") return;
  48  |     if (isDeliberatelyScrollable(el)) return;
  49  |     if (rect.right > vw + 1) {
  50  |       const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
  51  |       const text = (el.textContent ?? "").trim().slice(0, 30);
  52  |       offenders.push(
  53  |         `<${el.tagName.toLowerCase()}${classes ? "." + classes : ""}> "${text}" right=${Math.round(rect.right)} > viewport=${vw}`,
  54  |       );
  55  |     }
  56  |   });
  57  | 
  58  |   return offenders;
  59  | }
  60  | 
  61  | function findTinyTapTargets(minHeight: number) {
  62  |   const main = document.querySelector("main");
  63  |   if (!main) return [];
  64  |   const offenders: string[] = [];
  65  | 
  66  |   main.querySelectorAll("button, a").forEach((el) => {
  67  |     const rect = el.getBoundingClientRect();
  68  |     if (rect.width === 0 && rect.height === 0) return; // not visible, not a real target
  69  |     const style = getComputedStyle(el);
  70  |     if (style.display === "none" || style.visibility === "hidden") return;
  71  |     if (rect.height < minHeight) {
  72  |       const text = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30);
  73  |       offenders.push(`<${el.tagName.toLowerCase()}> "${text}" height=${rect.height.toFixed(1)}px`);
  74  |     }
  75  |   });
  76  | 
  77  |   return offenders;
  78  | }
  79  | 
  80  | async function assertLayoutInvariants(page: Page, label: string, width: number) {
  81  |   const { scrollWidth, clientWidth } = await page.evaluate(() => ({
  82  |     scrollWidth: document.documentElement.scrollWidth,
  83  |     clientWidth: document.documentElement.clientWidth,
  84  |   }));
  85  |   expect(
  86  |     scrollWidth,
  87  |     `${label} at ${width}px: the page scrolls sideways (document scrollWidth ${scrollWidth}px exceeds the ${width}px viewport)`,
  88  |   ).toBeLessThanOrEqual(width);
  89  |   // The viewport itself should report back at the width we asked for.
  90  |   expect(clientWidth).toBeLessThanOrEqual(width);
  91  | 
  92  |   const overflowing = await page.evaluate(findOverflowingElements);
  93  |   expect(
  94  |     overflowing,
  95  |     `${label} at ${width}px: ${overflowing.length} element(s) extend past the right edge of the viewport:\n${overflowing.join("\n")}`,
  96  |   ).toEqual([]);
  97  | 
  98  |   const cartLink = page.getByRole("link", { name: /^Cart/ });
  99  |   await expect(cartLink, `${label} at ${width}px: the cart link in the header is not visible`).toBeVisible();
  100 |   const cartBox = await cartLink.boundingBox();
  101 |   if (!cartBox) throw new Error(`${label} at ${width}px: the cart link has no bounding box`);
  102 |   expect(
  103 |     cartBox.x,
  104 |     `${label} at ${width}px: the cart link's left edge is off-screen (x=${cartBox.x})`,
  105 |   ).toBeGreaterThanOrEqual(0);
  106 |   expect(
  107 |     cartBox.x + cartBox.width,
  108 |     `${label} at ${width}px: the cart link's right edge is off-screen (right=${cartBox.x + cartBox.width}, viewport=${width})`,
  109 |   ).toBeLessThanOrEqual(width);
  110 | 
  111 |   const tiny = await page.evaluate(findTinyTapTargets, MIN_TAP_TARGET);
  112 |   expect(
  113 |     tiny,
  114 |     `${label} at ${width}px: ${tiny.length} tap target(s) inside <main> are under ${MIN_TAP_TARGET}px tall:\n${tiny.join("\n")}`,
> 115 |   ).toEqual([]);
      |     ^ Error: /cart at 430px: 1 tap target(s) inside <main> are under 36px tall:
  116 | }
  117 | 
  118 | for (const width of WIDTHS) {
  119 |   test.describe(`at ${width}px`, () => {
  120 |     for (const route of ROUTES) {
  121 |       test(`${route} never breaks layout`, async ({ page }) => {
  122 |         await page.setViewportSize({ width, height: 800 });
  123 |         await page.goto(route);
  124 |         await assertLayoutInvariants(page, route, width);
  125 |       });
  126 |     }
  127 | 
  128 |     test("/cart with items never breaks layout", async ({ page }) => {
  129 |       await page.setViewportSize({ width, height: 800 });
  130 |       await page.addInitScript(
  131 |         ([key, flavorId]) => {
  132 |           window.localStorage.setItem(key, JSON.stringify([{ flavorId, quantity: 2 }]));
  133 |         },
  134 |         [CART_STORAGE_KEY, seedFlavorId] as const,
  135 |       );
  136 |       await page.goto("/cart");
  137 |       await assertLayoutInvariants(page, "/cart (seeded with 2 items)", width);
  138 |     });
  139 |   });
  140 | }
  141 | 
```