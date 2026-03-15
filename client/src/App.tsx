import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import BrowserPage from "./pages/browser";
import NotFound from "./pages/not-found";
import { ThemeProvider } from "./components/ThemeProvider";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={BrowserPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
