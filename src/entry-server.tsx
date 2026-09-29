import { renderToString } from "react-dom/server";
import { Root } from "./Root";

/** The Arabic home page as it first renders, for scripts/prerender.mjs. */
export const render = () => renderToString(<Root admin={false} />);
