import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";

export default function Cadastro(){

  return(

    <Card>

      <h2>Cadastro</h2>

      <Input placeholder="Nome"/>
      <Input placeholder="Email"/>
      <Input placeholder="Senha" type="password"/>

      <Button text="Cadastrar"/>

    </Card>

  )

}