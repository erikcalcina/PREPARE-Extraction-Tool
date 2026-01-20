import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import UserAvatar from "./index";

const meta = {
  title: "Components/UserAvatar",
  component: UserAvatar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["small", "medium", "large"],
    },
  },
} satisfies Meta<typeof UserAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    username: "john_doe",
    size: "small",
  },
};

export const Medium: Story = {
  args: {
    username: "jane_smith",
    size: "medium",
  },
};

export const Large: Story = {
  args: {
    username: "Alice Cooper",
    size: "large",
  },
};

export const Clickable: Story = {
  args: {
    username: "clickable_user",
    size: "medium",
    onClick: fn(),
  },
};
