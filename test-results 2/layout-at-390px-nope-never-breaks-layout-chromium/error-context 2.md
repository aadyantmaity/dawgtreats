# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout.spec.ts >> at 390px >> /nope never breaks layout
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
    - heading "Nothing here" [level=1] [ref=e15]
    - paragraph [ref=e16]: That page doesn't exist. Looking for an order? Find it with its code.
    - generic [ref=e17]:
      - link "The menu" [ref=e18] [cursor=pointer]:
        - /url: /
      - generic [ref=e19]: ·
      - link "Find my order" [ref=e20] [cursor=pointer]:
        - /url: /order/lookup
  - button "Send feedback" [ref=e22]: +
  - alert [ref=e23]
```