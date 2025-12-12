import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Package } from "lucide-react";
import { Product } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PRODUCTS_KEY = "loyalty_products";

export default function ProductsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    productId: "",
    price: "",
    barcode: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    try {
      const saved = localStorage.getItem(PRODUCTS_KEY);
      if (saved) {
        setProducts(JSON.parse(saved));
      } else {
        // Default product
        const defaultProduct: Product = {
          id: "1",
          name: "Bem Lindinha",
          productId: "1000100",
          price: "100",
          barcode: "1000100",
          group: "4b",
          tax: "20",
        };
        setProducts([defaultProduct]);
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify([defaultProduct]));
      }
    } catch (error) {
      console.error("Failed to load products", error);
    }
  };

  const saveProducts = (updatedProducts: Product[]) => {
    try {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updatedProducts));
      setProducts(updatedProducts);
    } catch (error) {
      console.error("Failed to save products", error);
    }
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.productId || !newProduct.price) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha nome, ID do produto e preço",
        variant: "destructive",
      });
      return;
    }

    const product: Product = {
      id: Date.now().toString(),
      name: newProduct.name,
      productId: newProduct.productId,
      price: newProduct.price,
      barcode: newProduct.barcode || newProduct.productId,
      group: "4b",
      tax: "20",
    };

    saveProducts([...products, product]);
    setNewProduct({ name: "", productId: "", price: "", barcode: "" });
    
    toast({
      title: "Produto Adicionado",
      description: `${product.name} foi adicionado com sucesso`,
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (products.length === 1) {
      toast({
        title: "Não Permitido",
        description: "Deve haver pelo menos um produto cadastrado",
        variant: "destructive",
      });
      return;
    }

    const updated = products.filter(p => p.id !== id);
    saveProducts(updated);
    
    toast({
      title: "Produto Removido",
      description: "Produto foi removido com sucesso",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gerenciar Produtos</h1>
              <p className="text-sm text-muted-foreground">Configure os produtos disponíveis</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Novo Produto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Café Expresso"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  data-testid="input-product-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productId">Product ID *</Label>
                <Input
                  id="productId"
                  placeholder="Ex: 1000100"
                  value={newProduct.productId}
                  onChange={(e) => setNewProduct({ ...newProduct, productId: e.target.value })}
                  data-testid="input-product-id"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço (centavos) *</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="Ex: 100"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  data-testid="input-product-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Código de Barras</Label>
                <Input
                  id="barcode"
                  placeholder="Ex: 1000100 (opcional)"
                  value={newProduct.barcode}
                  onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                  data-testid="input-product-barcode"
                />
              </div>
            </div>

            <Button
              onClick={handleAddProduct}
              className="w-full"
              data-testid="button-add-product"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Produto
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos Cadastrados ({products.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                data-testid={`product-item-${product.id}`}
              >
                <div className="flex-1">
                  <h3 className="font-medium">{product.name}</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>ID: {product.productId}</span>
                    <span>Preço: {product.price}</span>
                    {product.barcode && <span>Barcode: {product.barcode}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteProduct(product.id)}
                  disabled={products.length === 1}
                  data-testid={`button-delete-${product.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
