import type { Meta, StoryObj } from "@storybook/react-vite";

import ProgressBar from "./index";

const meta = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    progress: {
      control: { type: "range", min: 0, max: 100 },
    },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    progress: 0,
  },
};

export const Partial: Story = {
  args: {
    progress: 45,
  },
};

export const Complete: Story = {
  args: {
    progress: 100,
  },
};

export const NoPercentage: Story = {
  args: {
    progress: 65,
    showPercentage: false,
  },
};
