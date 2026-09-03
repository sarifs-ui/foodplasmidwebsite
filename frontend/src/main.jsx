import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App.jsx";
import { ErrorBlock } from "./components/ui/index.jsx";
import { AboutPage } from "./pages/AboutPage.jsx";
import { ContactPage } from "./pages/ContactPage.jsx";
import { DataAccessPage } from "./pages/DataAccessPage.jsx";
import { DownloadsPage } from "./pages/DownloadsPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { SampleDetailPage } from "./pages/SampleDetailPage.jsx";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorBlock message="This page could not be loaded." />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "samples", element: <DataAccessPage /> },
      { path: "samples/:id", element: <SampleDetailPage /> },
      { path: "downloads", element: <DownloadsPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "*", element: <ErrorBlock message="Page not found." /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
