# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout.spec.ts >> at 430px >> /cart never breaks layout
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
    - status [ref=e15]: Loading your cart
    - list [ref=e19]:
      - listitem [ref=e20]
      - listitem [ref=e27]
  - button "Send feedback" [ref=e40]: +
  - alert [ref=e41]
```