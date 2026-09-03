import { Outlet, ScrollRestoration } from "react-router-dom";

import { Footer, Masthead, TabBar } from "./components/Shell.jsx";
import { GlobalStyles } from "./theme/GlobalStyles.jsx";

/**
 * Application shell: masthead, primary navigation, the routed page, footer.
 *
 * Page state lives in the URL (see main.jsx), so every view is linkable and the
 * browser's Back button moves through the app rather than leaving it.
 */
export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <GlobalStyles />
      <Masthead />
      <TabBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
