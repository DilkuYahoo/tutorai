/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import { X, AlertCircle, RefreshCw, Check } from "lucide-react";
import Header from "./Header";
import LeftSidebar from "./LeftSidebar";
import ChartSection from "./ChartSection";
import RightSidebar from "./RightSidebar";
import Footer from "./Footer";
import {
  fetchDashboardData,
  updateDashboardData,
} from "../services/dashboardService";
import { useAuth } from "../contexts/AuthContext";

interface DashboardData {
  chartData: any[];
  investors: any[];
  properties: any[];
  loading: boolean;
  error: string | null;
}

const Dashboard: React.FC = () => {
  const { handleAuthCallback, isLoading: authLoading } = useAuth();
  
  const [data, setData] = useState<DashboardData>({
    chartData: [],
    investors: [],
    properties: [],
    loading: true,
    error: null,
  });

  const [investorsVisible, setInvestorsVisible] = useState(true);
  const [propertiesVisible, setPropertiesVisible] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(100);

  // Handle OAuth callback on mount
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        try {
          await handleAuthCallback(code);
          // Clear the URL parameters after successful auth
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Authentication error:', error);
        }
      }
    };
    
    handleCallback();
  }, [handleAuthCallback]);

  useEffect(() => {
    const load = async () => {
      try {
        setData((prev) => ({ ...prev, loading: true, error: null }));

        const result = await fetchDashboardData();

        setData({
          ...result,
          loading: false,
          error: null,
        });
      } catch (err) {
        setData({
          chartData: [],
          investors: [],
          properties: [],
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        });
      }
    };

    // Only load data if auth is not loading
    if (!authLoading) {
      load();
    }
  }, [authLoading]);

  // Auto-dismiss update error with progress bar
  useEffect(() => {
    if (updateError) {
      setProgress(100);
      const duration = 5000;
      const interval = 50;
      const step = (interval / duration) * 100;

      const timer = setInterval(() => {
        setProgress((prev) => {
          const next = prev - step;
          if (next <= 0) {
            clearInterval(timer);
            setUpdateError(null);
            return 0;
          }
          return next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [updateError]);

  // Auto-dismiss update success with progress bar
  useEffect(() => {
    if (updateSuccess) {
      setProgress(100);
      const duration = 3000; // Shorter duration for success messages
      const interval = 50;
      const step = (interval / duration) * 100;

      const timer = setInterval(() => {
        setProgress((prev) => {
          const next = prev - step;
          if (next <= 0) {
            clearInterval(timer);
            setUpdateSuccess(null);
            return 0;
          }
          return next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [updateSuccess]);

  const handleUpdate = async (
    investors: any[],
    properties: any[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => {
    try {
      setUpdating(true);
      setUpdateError(null);
      setUpdateSuccess(null);
      await updateDashboardData(investors, properties, data.chartData);

      const result = await fetchDashboardData();
      setData({
        ...result,
        loading: false,
        error: null,
      });

      setUpdateSuccess("Data updated successfully!");
      onSuccess?.();
    } catch (err) {
      console.log("Error message:", err);
      setUpdateError("Update failed. Please try again.");
      onError?.();
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="flex flex-col h-screen transition-colors duration-300 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
      <div className="flex flex-1 overflow-hidden">
      {/* Main Error Toast */}
      {data.error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-xl z-50 w-100 animate-in slide-in-from-top-2 fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Error Loading Data</h3>
              <p className="text-xs text-red-100 mt-1 line-clamp-2">
                {data.error}
              </p>
            </div>
            <button
              onClick={() => setData((prev) => ({ ...prev, error: null }))}
              className="text-white/80 hover:text-white transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-xs font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Update Error Toast */}
      {updateError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-3 rounded-lg shadow-xl z-50 w-100 animate-in slide-in-from-top-2 fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2">{updateError}</p>
            </div>
            <button
              onClick={() => setUpdateError(null)}
              className="text-white/80 hover:text-white transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/70 rounded-full transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Update Success Toast */}
      {updateSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-3 rounded-lg shadow-xl z-50 w-100 animate-in slide-in-from-top-2 fade-in">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2">
                {updateSuccess}
              </p>
            </div>
            <button
              onClick={() => setUpdateSuccess(null)}
              className="text-white/80 hover:text-white transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/70 rounded-full transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {updating && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-slate-800 p-6 rounded-xl shadow-2xl text-center border border-slate-700">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-slate-600 border-t-cyan-400 mx-auto mb-3"></div>
            <p className="text-white font-medium">Updating...</p>
          </div>
        </div>
      )}

      <LeftSidebar
        investors={data.investors}
        properties={data.properties}
        loading={data.loading}
        isVisible={investorsVisible}
        onToggleVisibility={setInvestorsVisible}
        onUpdate={handleUpdate}
      />

      <ChartSection chartData={data.chartData} loading={data.loading} />

      <RightSidebar
        investors={data.investors}
        properties={data.properties}
        loading={data.loading}
        isVisible={propertiesVisible}
        onToggleVisibility={setPropertiesVisible}
        onUpdate={handleUpdate}
      />
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
