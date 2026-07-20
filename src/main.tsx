import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { createApplication } from "./app/composition/application";
import "./styles.css";

async function bootstrap() {
  const application = await createApplication();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App application={application} />
    </React.StrictMode>,
  );
}

void bootstrap();
