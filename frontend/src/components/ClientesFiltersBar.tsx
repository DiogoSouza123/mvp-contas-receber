"use client";

import { useRouter } from "next/navigation";
import { Button, Form, Input } from "antd";

import type { ClienteFilters } from "@/lib/clientes";

type Props = {
  filters: ClienteFilters;
};

export function ClientesFiltersBar({ filters }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<{ search?: string }>();

  function handleFinish(values: { search?: string }) {
    const params = new URLSearchParams();
    if (values.search) {
      params.set("search", values.search);
    }
    router.push(`/clientes?${params.toString()}`);
  }

  return (
    <Form
      form={form}
      layout="inline"
      onFinish={handleFinish}
      initialValues={{ search: filters.search }}
      style={{ marginTop: 16 }}
    >
      <Form.Item name="search" label="Buscar" style={{ minWidth: 320 }}>
        <Input placeholder="Nome, nome fantasia ou CPF/CNPJ" allowClear />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Buscar
        </Button>
      </Form.Item>
    </Form>
  );
}
