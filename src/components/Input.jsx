export default function Input({placeholder, type="text"}){

  return(

    <input
      type={type}
      placeholder={placeholder}
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