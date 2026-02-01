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

const sortableColumns: Column<SampleItem>[] = [
  { key: "id", header: "ID", width: "60px" },
  { key: "name", header: "Name", sortable: true },
  { key: "status", header: "Status", width: "100px", sortable: true },
  { key: "count", header: "Count", width: "80px", sortable: true },
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

export const SelectedRow: Story = {
  args: {
    columns,
    data: sampleData,
    keyExtractor: (item) => item.id,
    onRowClick: fn(),
    isRowSelected: (item) => item.id === 2,
  },
};

export const Sortable: Story = {
  args: {
    columns: sortableColumns,
    data: sampleData,
    keyExtractor: (item) => item.id,
    sort: { key: "name", direction: "asc" },
    onSortChange: fn(),
  },
};

export const Loading: Story = {
  args: {
    columns,
    data: [],
    keyExtractor: (item) => item.id,
    isLoading: true,
  },
};

export const LoadingOverlay: Story = {
  args: {
    columns,
    data: sampleData,
    keyExtractor: (item) => item.id,
    isLoadingOverlay: true,
  },
};

export const StickyHeader: Story = {
  args: {
    columns,
    data: [
      ...sampleData,
      { id: 4, name: "Item Four", status: "Active", count: 55 },
      { id: 5, name: "Item Five", status: "Pending", count: 3 },
      { id: 6, name: "Item Six", status: "Active", count: 29 },
      { id: 7, name: "Item Seven", status: "Inactive", count: 12 },
      { id: 8, name: "Item Eight", status: "Active", count: 99 },
    ],
    keyExtractor: (item) => item.id,
    stickyHeader: true,
  },
  decorators: [
    (Story) => {
      const div = document.createElement("div");
      div.style.maxHeight = "200px";
      div.style.overflow = "auto";
      return Story();
    },
  ],
};
