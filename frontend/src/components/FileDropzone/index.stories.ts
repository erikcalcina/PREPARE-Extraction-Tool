import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import FileDropzone from "./index";

const meta = {
  title: "Components/FileDropzone",
  component: FileDropzone,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FileDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onFileSelect: fn(),
    accept: ".csv,.json",
    maxSize: 50 * 1024 * 1024,
  },
};

export const Disabled: Story = {
  args: {
    onFileSelect: fn(),
    accept: ".csv,.json",
    disabled: true,
  },
};
