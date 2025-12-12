import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import { AdminRoute } from "@/components/admin-route";
import HomePage from "@/pages/home";
import ConfigurationPage from "@/pages/configuration";
import ProductsPage from "@/pages/products";
import AnalyticsPage from "@/pages/analytics";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      </Route>
      <Route path="/configuration">
        <ProtectedRoute>
          <AdminRoute>
            <ConfigurationPage />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/config">
        <ProtectedRoute>
          <AdminRoute>
            <ConfigurationPage />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/products">
        <ProtectedRoute>
          <AdminRoute>
            <ProductsPage />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <AdminRoute>
            <AnalyticsPage />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute>
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
