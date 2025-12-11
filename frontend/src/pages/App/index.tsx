import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthProvider from 'components/AuthProvider';
import ProtectedRoute from 'components/ProtectedRoute';

import Login from 'pages/Login';
import Datasets from 'pages/Datasets';
import DatasetRecords from 'pages/DatasetRecords';
import DatasetClusters from 'pages/DatasetClusters';
import DatasetUpload from 'pages/DatasetUpload';
import Vocabularies from 'pages/Vocabularies';
import VocabularyUpload from 'pages/VocabularyUpload';
import Monitor from 'pages/Monitor';
import UserProfile from 'pages/UserProfile';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
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
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
