export default function Card({children}){

  return(

    <div style={{
      minHeight:"100vh",
      display:"flex",
      justifyContent:"center",
      alignItems:"center"
    }}>

      <div style={{
        background:"white",
        padding:"40px",
        borderRadius:"10px",
        width:"350px",
        display:"flex",
        flexDirection:"column",
        gap:"15px",
        boxShadow:"0px 4px 10px rgba(0,0,0,0.15)"
      }}>

        {children}

      </div>

    </div>

  )

}