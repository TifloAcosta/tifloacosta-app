import {pathToFileURL} from 'node:url';
import fs from 'node:fs';

const keys=['action','approved','approvedBy','expectedBranch','expectedMainSha','requestId'];

export function validateUploadApproval(path,approval){
  const match=/^testflight-upload-approvals\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/i.exec(path||'');
  if(!match||approval?.requestId!==match[1])throw Error('La solicitud no coincide con su archivo');
  if(Object.keys(approval).sort().join(',')!==keys.slice().sort().join(','))throw Error('Campos de solicitud no permitidos');
  if(approval.action!=='upload-ios-testflight'||approval.approved!==true||approval.approvedBy!=='Tony Acosta'||approval.expectedBranch!=='main')
    throw Error('Falta autorización específica para TestFlight en main');
  if(!/^[0-9a-f]{40}$/.test(approval.expectedMainSha))throw Error('SHA de main inválido');
  return {requestId:approval.requestId,expectedMainSha:approval.expectedMainSha};
}

export async function dispatchUpload(approval,{fetchImpl=fetch,repo,token}){
  if(!/^TifloAcosta\/tifloacosta-app$/.test(repo)||!token)throw Error('Repositorio o token no autorizado');
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const main=await fetchImpl(`https://api.github.com/repos/${repo}/git/ref/heads/main`,{headers});
  if(!main.ok)throw Error('No se pudo verificar la rama main: HTTP '+main.status);
  const current=(await main.json()).object?.sha;
  if(current!==approval.expectedMainSha)throw Error('La rama main ha cambiado desde la autorización');
  const tag=`apple-chat-upload-${approval.requestId}`;
  const claimed=await fetchImpl(`https://api.github.com/repos/${repo}/git/refs`,{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({ref:`refs/tags/${tag}`,sha:current})
  });
  if(claimed.status===422)throw Error('La autorización ya fue utilizada; no se repite el envío');
  if(claimed.status!==201)throw Error('No se pudo reservar la autorización: HTTP '+claimed.status);
  const triggered=await fetchImpl(`https://api.github.com/repos/${repo}/actions/workflows/ios-native-testflight-upload.yml/dispatches`,{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({ref:tag})
  });
  if(triggered.status!==204)throw Error('GitHub no aceptó el envío a TestFlight: HTTP '+triggered.status);
  return {accepted:true,requestId:approval.requestId,sha:current};
}

async function main(){
  const path=process.env.APPROVAL_FILE;
  if(!path)throw Error('No hay archivo de aprobación');
  const approval=validateUploadApproval(path,JSON.parse(fs.readFileSync(path,'utf8')));
  if(process.env.UPLOAD_DISPATCH_EXECUTE!=='true'){
    console.log('SIMULACIÓN: aprobación válida, no se inicia ninguna compilación');
    return;
  }
  const result=await dispatchUpload(approval,{
    repo:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN
  });
  console.log('ORDEN ACEPTADA: envío TestFlight solicitado para '+result.sha+'; solicitud '+result.requestId);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
