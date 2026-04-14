import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const AdminRoute = ({ children }) => {
  const { currentUser } = useApp();

  if (!currentUser) return <Navigate to="/login" />;

  if (currentUser.role !== "admin") {
    return <Navigate to="/user/dashboard" />;
  }

  return children;
};

export default AdminRoute;