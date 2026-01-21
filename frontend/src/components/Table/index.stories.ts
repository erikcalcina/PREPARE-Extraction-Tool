import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import Table, { type Column, type TableProps } from "./index";

interface SampleItem {
  id: number;
  name: string;
  status: string;
  count: number;
}

const sampleData: SampleItem[] = [
  { id: 1, name: "Item One", status: "Active", count: 42 },
  { id: 2, name: "Item Two", status: "Pending", count: 17 },
  { id: 3, name: "Item Three", status: "Inactive", count: 8 },
];

const columns: Column<SampleItem>[] = [
  { key: "id", header: "ID", width: "60px" },
  { key: "name", header: "Name" },
  { key: "status", header: "Status", width: "100px" },
  { key: "count", header: "Count", width: "80px" },
];

const meta: Meta<TableProps<SampleItem>> = {
  title: "Components/Table",
  component: Table,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<TableProps<SampleItem>>;

export const Default: Story = {
  args: {
    columns,
    data: sampleData,
    keyExtractor: (item) => item.id,
  },
};

export const Empty: Story = {
  args: {
    columns,
    data: [],
    keyExtractor: (item) => item.id,
    emptyMessage: "No items to display",
  },
};

export const Clickable: Story = {
  args: {
    columns,
    data: sampleData,
    keyExtractor: (item) => item.id,
    onRowClick: fn(),
  },
};
