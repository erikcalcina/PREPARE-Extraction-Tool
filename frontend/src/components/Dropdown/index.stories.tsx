import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import Dropdown from './index';

const meta = {
    title: 'Components/Dropdown',
    component: Dropdown,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultItems = [
    { label: 'Edit', onClick: fn() },
    { label: 'Duplicate', onClick: fn() },
    { label: 'Archive', onClick: fn() },
];

export const Default: Story = {
    args: {
        trigger: <button type="button">Options</button>,
        items: defaultItems,
    },
};

export const LeftAligned: Story = {
    args: {
        trigger: <button type="button">Options</button>,
        items: defaultItems,
        align: 'left',
    },
};

export const WithDangerItem: Story = {
    args: {
        trigger: <button type="button">Actions</button>,
        items: [
            { label: 'Edit', onClick: fn() },
            { label: 'Share', onClick: fn() },
            { label: 'Delete', onClick: fn(), variant: 'danger' },
        ],
    },
};
