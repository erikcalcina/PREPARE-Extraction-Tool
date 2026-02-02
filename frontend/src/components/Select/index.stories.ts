import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./index";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["small", "medium"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const sampleOptions = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
  { value: "option4", label: "Option 4" },
];

const vocabularyOptions = [
  { value: "snomed", label: "SNOMED CT" },
  { value: "icd10", label: "ICD-10" },
  { value: "rxnorm", label: "RxNorm" },
  { value: "loinc", label: "LOINC" },
];

export const Default: Story = {
  args: {
    options: sampleOptions,
    placeholder: "Select an option...",
  },
};

export const WithPlaceholder: Story = {
  args: {
    options: vocabularyOptions,
    placeholder: "Select vocabulary...",
  },
};

export const WithValue: Story = {
  args: {
    options: vocabularyOptions,
    value: "snomed",
    placeholder: "Select vocabulary...",
  },
};

export const WithFilterCheckbox: Story = {
  args: {
    label: "Vocabulary",
    enabled: true,
    onEnabledChange: () => {},
    options: vocabularyOptions,
    placeholder: "Select vocabularies...",
  },
};

export const FilterCheckboxDisabled: Story = {
  args: {
    label: "Vocabulary",
    enabled: false,
    onEnabledChange: () => {},
    options: vocabularyOptions,
    placeholder: "Select vocabularies...",
  },
};

export const MultiSelect: Story = {
  args: {
    options: vocabularyOptions,
    placeholder: "Select vocabularies...",
    multiSelect: true,
    values: ["snomed", "icd10"],
  },
};

export const MultiSelectWithFilter: Story = {
  args: {
    label: "Vocabulary",
    enabled: true,
    onEnabledChange: () => {},
    options: vocabularyOptions,
    placeholder: "Select vocabularies...",
    multiSelect: true,
    values: ["snomed"],
  },
};

export const SmallSize: Story = {
  args: {
    options: [
      { value: "10", label: "10" },
      { value: "25", label: "25" },
      { value: "50", label: "50" },
      { value: "100", label: "100" },
    ],
    value: "25",
    size: "small",
    fullWidth: false,
  },
};

export const Disabled: Story = {
  args: {
    options: sampleOptions,
    placeholder: "Select an option...",
    disabled: true,
  },
};

export const NoOptions: Story = {
  args: {
    options: [],
    placeholder: "Select an option...",
  },
};
