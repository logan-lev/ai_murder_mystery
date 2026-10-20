// Entry point. Sends the visitor to the home page or the game based on the URL.

import { isHomeRoute } from "./seed";

// The home page and the game are separate modules, so the home page never builds a case
// or starts the model download, and the game code runs only when a case is opened.
if (isHomeRoute()) void import("./home");
else void import("./game");
