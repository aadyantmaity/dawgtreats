# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout.spec.ts >> at 430px >> /checkout never breaks layout
- Location: e2e/layout.spec.ts:121:11

# Error details

```
Error: page.evaluate: ReferenceError: findTinyTapTargets is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:14)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
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
    - heading "Checkout" [level=1] [ref=e15]
    - generic [ref=e16]:
      - paragraph [ref=e17]: Pickup Sat Oct 10 or Sun Oct 11
      - paragraph [ref=e18]: The Standard at Seattle, Midrise lobby
      - paragraph [ref=e19]: Orders close Thu, Oct 8, 11:59 PM PDT
    - paragraph [ref=e20]: Your cart is empty.
    - link "Back to the menu" [ref=e21] [cursor=pointer]:
      - /url: /
  - button "Send feedback" [ref=e23]: +
  - alert [ref=e24]
```