# yerevan-city-mcp

![Demo](files/yerevan-city-mcp-demo.gif)

Order groceries from [yerevan-city.am](https://yerevan-city.am) right from a
conversation with your AI assistant. Just say what you need — the agent finds
the products and builds the cart for you.

Set up once (you only need to confirm your phone number by SMS) and it keeps
working after that — no need to open the site and search for products by
hand.

**Safe by design**: the agent never pays or places an order — it only builds
the cart. Checkout and payment always stay with you, in your own browser or
app.

## What the agent can do

- Search products by name
- Show your saved delivery addresses
- Add and remove products from the cart
- Show the cart contents and total price
- Show your past orders, their totals and where they went
- Show the exact items in any one past order, and where it went

## Installation

The server is published on npm as
[`yerevan-city-mcp`](https://www.npmjs.com/package/yerevan-city-mcp) and runs
via `npx` — no download or build step needed.

Connect it in your AI assistant's settings.

**Claude Code** — run in a terminal:

```bash
claude mcp add yerevan-city -- npx -y yerevan-city-mcp
```

**Claude Desktop** — open the MCP server config file
(Settings → Developer → Edit Config) and add:

```json
{
  "mcpServers": {
    "yerevan-city": {
      "command": "npx",
      "args": ["-y", "yerevan-city-mcp"]
    }
  }
}
```

Restart the app after saving.

**Codex CLI** — run in a terminal:

```bash
codex mcp add yerevan-city -- npx -y yerevan-city-mcp
```

Or add it directly to `~/.codex/config.toml`:

```toml
[mcp_servers.yerevan-city]
command = "npx"
args = ["-y", "yerevan-city-mcp"]
```

**opencode** — add it to `opencode.json`:

```json
{
  "mcp": {
    "yerevan-city": {
      "type": "local",
      "command": ["npx", "-y", "yerevan-city-mcp"],
      "enabled": true
    }
  }
}
```

**Antigravity** — open the MCP store from the editor's agent panel,
select "Manage MCP Servers" → "View raw config", and add to
`~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "yerevan-city": {
      "command": "npx",
      "args": ["-y", "yerevan-city-mcp"]
    }
  }
}
```

Done. Tell the assistant something like "order milk and bread" — the
first time it touches the cart it will ask you to confirm your phone
number by SMS, and it stays logged in after that.

## Technical details

Login is a one-time phone + SMS step; the session is then cached locally so
it keeps working across restarts.

### Tools

- `request_login_code` / `confirm_login_code` — one-time phone + SMS login
- `search_products` — free-text product search
- `list_addresses` — the account's saved delivery addresses
- `get_order_history` — every past order, read-only, with its totals and address. `status` and `paymentMethod` come back as the site's own numeric codes and are passed through unlabelled.
- `get_order_details` — the line items of one past order, by the numeric `id` from `get_order_history`. Read-only. Includes the delivery address the order went to, in the same one-line form `get_order_history` reports it, but not the customer's phone numbers, card details or order comment. Weight-based items carry their amount in `weight` and report `quantity` 0, and the order's own totals are reported rather than recomputed. `status`, `paymentMethod` and `orderOriginType` are passed through as the site's numeric codes, like above.
- `add_to_cart` / `remove_from_cart` — build the cart, by piece count or by weight
- `get_cart` — current cart contents and total price

### Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm start
```

To point an AI assistant at a local build instead of the published package,
use `node /full/path/to/dist/index.js` as the command in place of
`npx -y yerevan-city-mcp`.

## License

Free for personal and other non-commercial use. Commercial use requires a
separate paid license — see [LICENSE](LICENSE) for details, and reach out
via [GitHub](https://github.com/tjvjk/) to arrange one.

## Disclaimer

This is an educational, unofficial project — an example of connecting an AI
agent to a third-party web API. It is provided as-is with no warranty of
any kind. It is not affiliated with, endorsed by, or sponsored by Yerevan
City / City Supermarket in any way.

## TODO

- How does the flow behave for a phone number with no existing yerevan-city.am account yet?
- What if the account has no saved address at all (not just none given explicitly)?
- Label the order `status` / `paymentMethod` / `orderOriginType` codes (and the
  `activityType` of an order's timeline), and add paging or filtering for
  accounts with a long order history. The API does send its own
  `paymentTypeName` label for the payment method — worth checking whether the
  site's order pages expose equivalents for the others.
- add Carrefour, Zovk, Sas, 88, Tsiran to find a better price
- add a `--version` CLI flag to print the installed package version
