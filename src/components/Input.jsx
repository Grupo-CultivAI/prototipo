export default function Input({placeholder, type="text", ...props}){

  return(

    <input
      type={type}
      placeholder={placeholder}
      {...props}
      style={{
        width:"100%",
        padding:"10px",
        marginBottom:"12px",
        border:"1px solid #ccc",
        borderRadius:"6px"
      }}
    />

  )

}