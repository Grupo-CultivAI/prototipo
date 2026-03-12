import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";

export default function Login(){

  return(

    <Card>

      <h2>Login</h2>

      <Input placeholder="Email"/>
      <Input placeholder="Senha" type="password"/>

      <Button text="Entrar"/>

    </Card>

  )

}