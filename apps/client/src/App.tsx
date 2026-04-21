import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/signup"
        element={<ComingSoonPage title="Sign up" phase="Phase 1" />}
      />
      <Route
        path="/login"
        element={<ComingSoonPage title="Log in" phase="Phase 1" />}
      />
      <Route
        path="/chats"
        element={<ComingSoonPage title="Your chats" phase="Phase 3" />}
      />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
