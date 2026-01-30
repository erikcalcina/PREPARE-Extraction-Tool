import type { Meta, StoryObj } from "@storybook/react-vite";

import { fn } from "storybook/test";

import Button from "./index";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "success", "danger", "warning", "info", "ghost", "outline"],
    },
    size: {
      control: "select",
      options: ["small", "medium", "large", "icon"],
    },
    colorScheme: {
      control: "select",
      options: ["default", "danger", "primary"],
    },
  },
  args: { onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "primary",
    label: "Primary Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    label: "Secondary Button",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    label: "Success Button",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    label: "Danger Button",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    label: "Warning Button",
  },
};

export const Info: Story = {
  args: {
    variant: "info",
    label: "Info Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    label: "Ghost Button",
  },
};

export const GhostDanger: Story = {
  args: {
    variant: "ghost",
    colorScheme: "danger",
    label: "Delete",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    label: "Outline Button",
  },
};

export const Small: Story = {
  args: {
    variant: "primary",
    size: "small",
    label: "Small Button",
  },
};

export const Large: Story = {
  args: {
    variant: "primary",
    size: "large",
    label: "Large Button",
  },
};

export const Disabled: Story = {
  args: {
    variant: "primary",
    label: "Disabled Button",
    disabled: true,
  },
};
