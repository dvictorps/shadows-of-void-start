import { eslintCompatPlugin } from "@oxlint/plugins";
import youMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";

const plugin = eslintCompatPlugin({
  meta: { name: "you-might-not-need-an-effect" },
  rules: youMightNotNeedAnEffect.rules,
});

export default plugin;
