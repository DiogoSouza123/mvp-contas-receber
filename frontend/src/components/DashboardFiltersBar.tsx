"use client";

import { useRouter } from "next/navigation";
import { Button, DatePicker, Form, Input, Select } from "antd";
import dayjs from "dayjs";

import type { DashboardFilters, DashboardStatus } from "@/lib/dashboard";

type Props = {
  filters: DashboardFilters;
};

type FormValues = {
  range?: [dayjs.Dayjs, dayjs.Dayjs];
  status: DashboardStatus;
  search?: string;
};

const statusOptions: { value: DashboardStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Em aberto" },
  { value: "overdue", label: "Vencidos" },
  { value: "paid", label: "Pagos" }
];

export function DashboardFiltersBar({ filters }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();

  function handleFinish(values: FormValues) {
    const params = new URLSearchParams();
    if (values.range) {
      params.set("startDate", values.range[0].format("YYYY-MM-DD"));
      params.set("endDate", values.range[1].format("YYYY-MM-DD"));
    }
    if (values.status) {
      params.set("status", values.status);
    }
    if (values.search) {
      params.set("search", values.search);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <Form<FormValues>
      form={form}
      layout="inline"
      onFinish={handleFinish}
      initialValues={{
        range: [dayjs(filters.startDate), dayjs(filters.endDate)],
        status: filters.status,
        search: filters.search
      }}
      style={{ marginTop: 16, rowGap: 12 }}
    >
      <Form.Item name="range" label="Período">
        <DatePicker.RangePicker format="DD/MM/YYYY" />
      </Form.Item>
      <Form.Item name="status" label="Status">
        <Select style={{ width: 160 }} options={statusOptions} />
      </Form.Item>
      <Form.Item name="search" label="Busca" style={{ minWidth: 260 }}>
        <Input placeholder="Cliente, CPF/CNPJ, documento, nosso número" allowClear />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Aplicar filtros
        </Button>
      </Form.Item>
    </Form>
  );
}
