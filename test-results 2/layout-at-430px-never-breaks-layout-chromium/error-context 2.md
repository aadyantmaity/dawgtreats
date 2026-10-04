# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout.spec.ts >> at 430px >> / never breaks layout
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
    - heading "This week's bake" [level=1] [ref=e15]
    - generic [ref=e16]:
      - paragraph [ref=e17]: Orders close Thu, Oct 8, 11:59 PM PDT
      - paragraph [ref=e18]: Pickup Sat Oct 10 or Sun Oct 11
    - paragraph [ref=e19]:
      - text: Questions about ingredients or allergens? Email
      - link "orders@dawgtreats.shop" [ref=e20] [cursor=pointer]:
        - /url: mailto:orders@dawgtreats.shop
    - generic [ref=e21]:
      - article [ref=e22]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - heading "Brown butter choc chip" [level=2] [ref=e32]
            - generic [ref=e33]: $3.50
          - paragraph [ref=e34]: Sea salt, dark chocolate, crisp edges.
        - generic [ref=e35]:
          - generic [ref=e36]: 24 left
          - button "Add" [ref=e38]
        - group [ref=e39]:
          - generic "Allergens" [ref=e40] [cursor=pointer]
      - article [ref=e41]:
        - generic [ref=e50]:
          - heading "Snickerdoodle" [level=2] [ref=e51]
          - generic [ref=e52]: $3.00
        - generic [ref=e53]:
          - generic [ref=e54]: 18 left
          - button "Add" [ref=e56]
        - group [ref=e57]:
          - generic "Allergens" [ref=e58] [cursor=pointer]
    - paragraph [ref=e59]: Pickup only, Saturday or Sunday. No refunds or cancellations.
  - button "Send feedback" [ref=e61]: +
  - alert [ref=e62]
```