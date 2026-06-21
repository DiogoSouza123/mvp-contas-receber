"use client";

import { useRouter } from "next/navigation";
import { Button, DatePicker, Form, Select } from "antd";
import dayjs from "dayjs";

import type { CobrancaFilters } from "@/lib/cobrancas";

type Props = {
  filters: CobrancaFilters;
};

type FormValues = {
  range: [dayjs.Dayjs, dayjs.Dayjs];
  status: CobrancaFilters["status"];
};

const statusOptions: { value: CobrancaFilters["status"]; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "sucesso", label: "Sucesso" },
  { value: "falha", label: "Falha" }
];

export function CobrancasFiltersBar({ filters }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();

  function handleFinish(values: FormValues) {
    const params = new URLSearchParams();
    params.set("startDate", values.range[0].format("YYYY-MM-DD"));
    params.set("endDate", values.range[1].format("YYYY-MM-DD"));
    params.set("status", values.status);
    router.push(`/cobrancas?${params.toString()}`);
  }

  return (
    <Form<FormValues>
      form={form}
      layout="inline"
      onFinish={handleFinish}
      initialValues={{
        range: [dayjs(filters.startDate), dayjs(filters.endDate)],
        status: filters.status
      }}
      style={{ marginTop: 16 }}
    >
      <Form.Item name="range" label="Período">
        <DatePicker.RangePicker format="DD/MM/YYYY" />
      </Form.Item>
      <Form.Item name="status" label="Status">
        <Select style={{ width: 160 }} options={statusOptions} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Aplicar filtros
        </Button>
      </Form.Item>
    </Form>
  );
}
