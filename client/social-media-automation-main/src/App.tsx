import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Layout from "./components/Home/Layout";
import { Dashboard } from "./pages/Dashboard";
import Aicomposer from "./pages/Aicomposer";
import Schedular from "./pages/Schedular";
import Account from "./pages/Account";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<Account />} />
          <Route path="/schedule" element={<Schedular />} />
          <Route path="/aicomposer" element={<Aicomposer />} />
        </Route>
      </Routes>
    </>
  );
}
