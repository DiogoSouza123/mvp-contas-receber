"use client";

import { useRouter } from "next/navigation";
import { Button, DatePicker, Form } from "antd";
import dayjs from "dayjs";

import type { EfetividadeFilters } from "@/lib/efetividade";

type Props = {
  filters: EfetividadeFilters;
};

type FormValues = {
  range: [dayjs.Dayjs, dayjs.Dayjs];
};

export function EfetividadeFiltersBar({ filters }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();

  function handleFinish(values: FormValues) {
    const params = new URLSearchParams();
    params.set("startDate", values.range[0].format("YYYY-MM-DD"));
    params.set("endDate", values.range[1].format("YYYY-MM-DD"));
    router.push(`/relatorios?${params.toString()}`);
  }

  return (
    <Form<FormValues>
      form={form}
      layout="inline"
      onFinish={handleFinish}
      initialValues={{ range: [dayjs(filters.startDate), dayjs(filters.endDate)] }}
      style={{ marginTop: 16 }}
    >
      <Form.Item name="range" label="Período">
        <DatePicker.RangePicker format="DD/MM/YYYY" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Aplicar filtros
        </Button>
      </Form.Item>
    </Form>
  );
}
