import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';

import AuthProvider from 'components/AuthProvider';
import Layout from './index';

const meta = {
    title: 'Components/Layout',
    component: Layout,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <AuthProvider>
                    <Story />
                </AuthProvider>
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: (
            <div style={{ padding: '2rem' }}>
                <h1>Page Content</h1>
                <p>This is the main content area of the layout.</p>
            </div>
        ),
    },
};

export const WithSidebar: Story = {
    args: {
        children: (
            <div style={{ padding: '2rem' }}>
                <h1>Main Content</h1>
                <p>This layout includes a sidebar navigation.</p>
            </div>
        ),
        sidebar: (
            <nav style={{ padding: '1rem' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <li style={{ marginBottom: '0.5rem' }}>
                        <a href="#">Dashboard</a>
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                        <a href="#">Settings</a>
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                        <a href="#">Profile</a>
                    </li>
                </ul>
            </nav>
        ),
    },
};
