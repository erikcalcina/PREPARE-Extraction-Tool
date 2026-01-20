import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthProvider from "components/AuthProvider";
import ProtectedRoute from "components/ProtectedRoute";

const Login = lazy(() => import("pages/Login"));
const Datasets = lazy(() => import("pages/Datasets"));
const DatasetOverview = lazy(() => import("pages/DatasetOverview"));
const DatasetRecords = lazy(() => import("pages/DatasetRecords"));
const DatasetClusters = lazy(() => import("pages/DatasetClusters"));
const DatasetMapping = lazy(() => import("pages/DatasetMapping"));
const DatasetUpload = lazy(() => import("pages/DatasetUpload"));
const Vocabularies = lazy(() => import("pages/Vocabularies"));
const VocabularyUpload = lazy(() => import("pages/VocabularyUpload"));
const Monitor = lazy(() => import("pages/Monitor"));
const UserProfile = lazy(() => import("pages/UserProfile"));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/datasets"
              element={
                <ProtectedRoute>
                  <Datasets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/datasets/upload"
              element={
                <ProtectedRoute>
                  <DatasetUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/datasets/:datasetId"
              element={
                <ProtectedRoute>
                  <DatasetOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/datasets/:datasetId/records"
              element={
                <ProtectedRoute>
                  <DatasetRecords />
                </ProtectedRoute>
              }
            />
            <Route
              path="/datasets/:datasetId/clusters"
              element={
                <ProtectedRoute>
                  <DatasetClusters />
                </ProtectedRoute>
              }
            />
            <Route
              path="/datasets/:datasetId/mapping"
              element={
                <ProtectedRoute>
                  <DatasetMapping />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vocabularies"
              element={
                <ProtectedRoute>
                  <Vocabularies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vocabularies/upload"
              element={
                <ProtectedRoute>
                  <VocabularyUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitor"
              element={
                <ProtectedRoute>
                  <Monitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/datasets" replace />} />
            <Route path="*" element={<Navigate to="/datasets" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
